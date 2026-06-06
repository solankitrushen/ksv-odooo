const isRegisterPage = (req, res, next) => {
  if (req.path === '/register') {
    return next();
  }

  next();
};
export default isRegisterPage;