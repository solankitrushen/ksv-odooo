import categories from "../Schema/Category.js";

const CreateSubCategory = async (req, res) => {
  try {
    const categoryData = req.body;
    console.log(categoryData);
    const createdCategories = [];

    for (const category of categoryData) {
      const createdCategory = await categories.create(category);
      createdCategories.push(createdCategory);
    }

    if (createdCategories.length > 0) {
      res.json({ message: "Products created successfully", createdCategories });
    } else {
      res.json({ message: "No products were created" });
    }
  } catch (error) {
    console.error("Error creating products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default CreateSubCategory;
