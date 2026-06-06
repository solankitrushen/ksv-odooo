import Survey from "../Schema/SurveyForm.js";

const GetSurvey = async (req, res) => {
  try {
    const { empId, surveyId, mainId } = await req.query;
    const query = {};

    if (empId) {
      query.empId = empId;
    }
    if (surveyId) {
      query.surveyId = surveyId;
    }
    if (mainId) {
      query.mainId = mainId;
    }
    const findSurvey = await Survey.find(query);
    res.status(200).json({ findSurvey });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err);
  }
};
export default GetSurvey;
