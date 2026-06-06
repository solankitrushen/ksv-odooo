import registerUsers from "../Schema/register.js";

const GetEmployees = async (req, res) => {
  try {
    const { empId, isConfirmed, cartId, email, role } = await req.query;
    const query = {};

    if (empId) {
      query.empId = empId;
    }

    if (isConfirmed) {
      query.isConfirmed = isConfirmed;
    }

    if (cartId) {
      query.cartId = cartId;
    }
    if (email) {
      query.email = email;
    }
    if (role) {
      query.role = role;
    }

    const findEmployees = await registerUsers.find(query);
    res.status(200).json({ findEmployees });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};
export default GetEmployees;
