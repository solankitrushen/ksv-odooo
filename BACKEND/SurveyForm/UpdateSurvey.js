import Survey from "../Schema/SurveyForm.js";

const UpdateSurvey = async (req, res) => {
  try {
    const { mainId } = req.query;
    // console.log(surveyData);

    const updatedSurvey = await Survey.updateOne(
      { mainId },
      { $set: { isShown: true } }
    );
    if (updatedSurvey) {
      res.json({ message: "Survey updated successfully", updatedSurvey });
    } else {
      res.json({ message: "No Survey were created" });
    }
  } catch (error) {
    console.error("Error creating Syrvey:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default UpdateSurvey;
