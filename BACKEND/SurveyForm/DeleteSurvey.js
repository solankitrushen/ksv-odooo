import Survey from "../Schema/SurveyForm.js";

const DeleteSurvey = async (req, res) => {
  try {
    const { surveyId } = await req.query;
    const query = {};

    if (surveyId) {
      query.surveyId = surveyId;
    }

    const DeledSurvey = await Survey.deleteOne(query);
    res.status(200).json({ DeledSurvey });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};
export default DeleteSurvey;
