import categories from "../Schema/Category.js";

const DeleteCategory = async (req, res) => {
  try {
    const { categoryId } = await req.body;

    const deletedCategories = await categories.deleteOne({ categoryId });
    res
      .status(200)
      .json({ message: "Category Deleted Successfully", deletedCategories });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};
export default DeleteCategory;
