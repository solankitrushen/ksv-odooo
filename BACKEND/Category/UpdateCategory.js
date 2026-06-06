import categories from "../Schema/Category.js";

const UpdateCategory = async (req, res) => {
  try {
    const categoryData = req.body;
    // console.log(categoryData);

    const updatedCategory = await categories.updateOne(
      { categoryId: categoryData.categoryId },
      categoryData
    );

    if (updatedCategory) {
      res.json({ message: "Category updated successfully", updatedCategory });
    } else {
      res.json({ message: "No Category were created" });
    }
  } catch (error) {
    console.error("Error updating Category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default UpdateCategory;
