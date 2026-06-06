import Survey from "../Schema/SurveyForm.js";

const CreateSurveyForm = async (req, res) => {
  try {
    const surveyData = req.body;
    console.log(surveyData);

    const createdSurvey = await Survey.create(surveyData);
    if (createdSurvey) {
      res.json({ message: "Survey created successfully", createdSurvey });
    } else {
      res.json({ message: "No Survey were created" });
    }
  } catch (error) {
    console.error("Error creating Syrvey:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default CreateSurveyForm;
