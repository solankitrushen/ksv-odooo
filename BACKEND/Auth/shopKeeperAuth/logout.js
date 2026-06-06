const logout = async (req, res) => {
  try {
    res.clearCookie("Authtoken");
    res.clearCookie("branchAuthtoken");
    res.clearCookie("shopKeeperAuthToken");
    return res.status(200).json({ message: "logout successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export default logout;
