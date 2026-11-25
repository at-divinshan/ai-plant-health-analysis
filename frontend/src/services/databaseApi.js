import axios from "axios";

const client = axios.create({ baseURL: import.meta.env?.VITE_API_URL || "http://localhost:8000", timeout: 30000 });

export async function databaseRequest(method, path, data, params) {
  try {
    return (await client.request({ method, url: path, data, params })).data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const fields = error.response?.data?.fields;
    const message = typeof detail === "string" ? detail : "The database request failed. Please try again.";
    if (error.response) throw new Error(fields ? `${message} ${Object.values(fields).join(" ")}` : message);
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
}

export const peopleApi = {
  list: (q = "") => databaseRequest("get", "/people", undefined, { q }),
  plants: id => databaseRequest("get", `/people/${id}/plants`),
  add: person => databaseRequest("post", "/people", person),
  edit: (id, person) => databaseRequest("put", `/people/${id}`, person),
  remove: id => databaseRequest("delete", `/people/${id}`),
};
export const sharingApi = {
  list: id => databaseRequest("get", `/analyses/${id}/shares`),
  update: (id, person_ids) => databaseRequest("put", `/analyses/${id}/shares`, { person_ids }),
};
