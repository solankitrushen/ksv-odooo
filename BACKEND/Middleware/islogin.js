const isLoggedIn = (req, res, next) => {
    if (!req.cookies.Authtoken || !req.cookies.branchAuthtoken) {
      return res.redirect('/login');
    }
  
    next();
  };
export default isLoggedIn;