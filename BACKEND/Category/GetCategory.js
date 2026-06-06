import categories from "../Schema/Category.js";

const GetCategory = async (req, res) => {
  try {
    const { categoryId } = await req.query;
    const query = {};

    if (categoryId) {
      query.categoryId = categoryId;
    }

    const findCategories = await categories.find(query);
    res.status(200).json({ findCategories });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};
export default GetCategory;
