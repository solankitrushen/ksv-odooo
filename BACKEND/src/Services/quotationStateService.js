import { QUOTATION_STATUS } from "../../config/constants.js";

/**
 * quotationStateService — pure deadline-aware state machine (SPEC-VB-003 FR-12).
 *
 * Never trusts a client-supplied status. Transitions are validated here; the
 * actual atomic write (submit race) is enforced at the DB layer with a
 * conditional findOneAndUpdate in the controller.
 *
 *   draft     → submitted (now <= deadline)
 *   draft     → withdrawn (now <= deadline)        [drop a draft]
 *   draft     → expired   (now >  deadline)        [worker / inline]
 *   submitted → withdrawn (now <= deadline)
 *   submitted → submitted (resubmit clone produces a NEW draft, handled apart)
 *
 * After deadline: submitted freezes, draft expires. No edits to a submitted
 * quote's prices (immutable_after_submit enforced in controller).
 */

export const ACTIONS = {
  SUBMIT: "submit",
  WITHDRAW: "withdraw",
  EXPIRE: "expire",
  REAFFIRM: "reaffirm",
};

/**
 * @param {string} status current quotation status
 * @param {string} action one of ACTIONS
 * @param {{now?:Date, deadline?:Date|string}} ctx
 * @returns {{ok:boolean, code?:string, message?:string, next?:string}}
 */
export function canTransition(status, action, ctx = {}) {
  const now = ctx.now ? new Date(ctx.now).getTime() : Date.now();
  const deadline = ctx.deadline ? new Date(ctx.deadline).getTime() : Infinity;
  const passed = now > deadline;

  switch (action) {
    case ACTIONS.SUBMIT:
      if (status !== QUOTATION_STATUS.DRAFT)
        return deny("not_draft", "Only a draft can be submitted");
      if (passed) return deny("deadline_passed", "RFQ deadline has passed");
      return allow(QUOTATION_STATUS.SUBMITTED);

    case ACTIONS.WITHDRAW:
      if (
        status !== QUOTATION_STATUS.DRAFT &&
        status !== QUOTATION_STATUS.SUBMITTED
      )
        return deny("not_withdrawable", "Only draft/submitted can be withdrawn");
      if (passed) return deny("deadline_passed", "RFQ deadline has passed");
      return allow(QUOTATION_STATUS.WITHDRAWN);

    case ACTIONS.EXPIRE:
      if (status !== QUOTATION_STATUS.DRAFT)
        return deny("not_expirable", "Only a draft expires");
      if (!passed) return deny("not_past_deadline", "Deadline not reached");
      return allow(QUOTATION_STATUS.EXPIRED);

    case ACTIONS.REAFFIRM:
      // reaffirm only clears staleFlag; status unchanged, must be draft/submitted
      if (
        status !== QUOTATION_STATUS.DRAFT &&
        status !== QUOTATION_STATUS.SUBMITTED
      )
        return deny("not_reaffirmable", "Only active quotes can be reaffirmed");
      return allow(status);

    default:
      return deny("unknown_action", `Unknown action: ${action}`);
  }
}

/** True when the quotation's prices are immutable (submitted/expired/withdrawn). */
export function isPriceImmutable(status) {
  return status !== QUOTATION_STATUS.DRAFT;
}

function allow(next) {
  return { ok: true, next };
}
function deny(code, message) {
  return { ok: false, code, message };
}

export default { canTransition, isPriceImmutable, ACTIONS };
