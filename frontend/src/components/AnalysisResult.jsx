
import {
  Sprout,
  AlertTriangle,
  FileText,
  ListChecks,
  Stethoscope,
  Info,
  RotateCcw,
  Thermometer,
  Sun,
  Droplets,
  Wind,
  Bookmark,
  Check,
  CalendarDays,
  Image as ImageIcon,
} from "lucide-react";

import { formatAnalysisDate } from "../services/savedAnalyses.js";

export default function AnalysisResult({
  plant,
  result,
  imagePreview = null,
  onReset,
  analyzedAt,
  onSave,
  isSaved = false,
  saving = false,
  saveMessage,
  saveError,
}) {
  return (
    <div className="results" aria-live="polite">
      <div className="results-heading">
        <span className="eyebrow">
          A LITTLE CLARITY FOR YOUR PLANT
        </span>

        <h2>Your plant care insights</h2>

        <p className="muted">
          Understand the signs. Take the next step with care.
        </p>

        {analyzedAt && (
          <time
            className="analysis-date"
            dateTime={analyzedAt}
          >
            <CalendarDays size={15} />
            Analyzed {formatAnalysisDate(analyzedAt)}
          </time>
        )}
      </div>

      {/* Uploaded plant image */}
      {imagePreview && (
        <div className="card">
          <h3>
            <ImageIcon size={20} />
            Uploaded Plant Image
          </h3>

          <p className="muted">
            This image was included in the AI plant health
            analysis.
          </p>

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "center",
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "#f4f9f4",
              border: "1px solid #dcebdd",
            }}
          >
            <img
              src={imagePreview}
              alt={`Uploaded image of ${plant.plant_name}`}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "380px",
                objectFit: "contain",
                borderRadius: "10px",
              }}
            />
          </div>
        </div>
      )}

      {/* Plant information */}
      <div className="card">
        <h3>
          <Sprout size={20} /> Plant Information
        </h3>

        <ul className="info-list">
          <li>
            <strong>Name:</strong> {plant.plant_name}
          </li>

          <li>
            <strong>Type:</strong> {plant.plant_type}
          </li>

          <li>
            <strong>Location:</strong>{" "}
            {plant.location || "Not provided"}
          </li>

          <li>
            <strong>Symptoms:</strong> {plant.symptom}
          </li>
        </ul>
      </div>

      {/* Possible issue */}
      <div className="card issue-card">
        <h3>
          <AlertTriangle size={20} /> Possible Issue
        </h3>

        <p>{result.possible_issue}</p>
      </div>

      {/* Explanation */}
      <div className="card">
        <h3>
          <FileText size={20} /> Short Explanation
        </h3>

        <p>{result.explanation}</p>
      </div>

      {/* Care suggestions */}
      <div className="card care-card">
        <h3>
          <ListChecks size={20} /> Care Suggestions
        </h3>

        <ol className="tips">
          {(result.care_suggestions || []).map(
            (tip, index) => (
              <li key={index}>{tip}</li>
            )
          )}
        </ol>
      </div>

      {/* Expert advice */}
      <div className="card">
        <h3>
          <Stethoscope size={20} />
          Expert Agricultural Advice
        </h3>

        <p>{result.expert_advice}</p>

        {result.expert_advice_needed === true && (
          <p className="alert" role="alert">
            <AlertTriangle
              size={18}
              aria-hidden="true"
            />
            {" "}
            Expert agricultural advice is recommended.
          </p>
        )}
      </div>

      {/* Growing conditions */}
      <section
        className="growing-guidance"
        aria-labelledby="growing-guidance-title"
      >
        <div className="guidance-heading">
          <span className="eyebrow">
            EVERYDAY PLANT CARE
          </span>

          <h3 id="growing-guidance-title">
            Recommended growing conditions
          </h3>

          <p>
            Approximate AI guidance, not guaranteed
            requirements. Adjust to your plant’s response
            and actual growing conditions.
          </p>
        </div>

        <div className="guidance-grid">
          {[
            {
              field: "ideal_temperature",
              title: "Ideal Temperature (°C)",
              icon: Thermometer,
              tone: "temperature",
            },
            {
              field: "sunlight_requirements",
              title: "Sunlight Requirements",
              icon: Sun,
              tone: "sunlight",
            },
            {
              field: "watering_frequency",
              title: "Watering Frequency",
              icon: Droplets,
              tone: "watering",
            },
            {
              field: "humidity_level",
              title: "Humidity Level (%)",
              icon: Wind,
              tone: "humidity",
            },
          ].map(
            ({ field, title, icon: Icon, tone }) => (
              <article
                className={`card guidance-card guidance-${tone}`}
                key={field}
              >
                <h4>
                  <Icon
                    size={22}
                    aria-hidden="true"
                  />
                  {title}
                </h4>

                <span className="guidance-badge">
                  Approximate guidance
                </span>

                <p>
                  {result[field] ||
                    "Recommendation unavailable. Try another analysis for updated guidance."}
                </p>
              </article>
            )
          )}
        </div>
      </section>

      {/* Disclaimer */}
      <div className="card disclaimer">
        <h3>
          <Info size={20} />
          Educational Disclaimer
        </h3>

        <p>
          This result is for educational purposes only
          and is not a guaranteed diagnosis. For serious
          or spreading problems, please consult a
          qualified agricultural expert.
        </p>
      </div>

      {/* Actions */}
      <div className="result-actions">
        {onSave && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={isSaved || saving}
          >
            {isSaved ? (
              <Check size={18} />
            ) : (
              <Bookmark size={18} />
            )}

            {saving
              ? "Saving…"
              : isSaved
              ? "Analysis Saved"
              : "Save Analysis"}
          </button>
        )}

        <button
          type="button"
          className={`btn ${
            onSave
              ? "btn-secondary"
              : "btn-primary"
          }`}
          onClick={onReset}
          disabled={saving}
        >
          <RotateCcw size={18} />
          Analyze Another Plant
        </button>

        {saveMessage && (
          <p
            className="save-success"
            role="status"
          >
            {saveMessage}{" "}
            <a href="#saved">
              View saved analyses
            </a>
          </p>
        )}

        {saveError && (
          <p className="alert" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
}
