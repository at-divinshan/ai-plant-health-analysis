
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function analyzePlant(plantData, image = null) {
  const formData = new FormData();

  formData.append("plant_name", plantData.plant_name);
  formData.append("plant_type", plantData.plant_type);
  formData.append("location", plantData.location || "");
  formData.append("symptom", plantData.symptom);

  if (image) {
    formData.append("image", image);
  }

  try {
    const response = await axios.post(
      `${API_URL}/analyze`,
      formData,
      {
        timeout: 120000,
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      const detail = error.response.data?.detail;

      throw new Error(
        typeof detail === "string"
          ? detail
          : "Please check your plant details and image."
      );
    }

    if (
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT"
    ) {
      throw new Error(
        "The AI analysis took too long. Please try again."
      );
    }

    throw new Error(
      "Cannot reach the server. Please make sure the backend is running."
    );
  }
}
