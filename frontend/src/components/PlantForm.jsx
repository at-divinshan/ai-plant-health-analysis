
import { useEffect, useRef, useState } from "react";
import {
  Users,
  Sparkles,
  Leaf,
  MapPin,
  LayoutGrid,
  FileText,
  ArrowUpRight,
  ImagePlus,
  X,
} from "lucide-react";

import { peopleApi } from "../services/databaseApi.js";

const PLANT_TYPES = [
  "Vegetable",
  "Fruit",
  "Flower",
  "Herb",
  "Tree",
  "Indoor Plant",
  "Other",
];

const EMPTY_FORM = {
  plant_name: "",
  plant_type: "",
  location: "",
  symptom: "",
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const INVALID_WORDS = new Set([
  "asdf",
  "asdfg",
  "asdfgh",
  "asdfghjkl",
  "qwerty",
  "qwertyuiop",
  "zxcv",
  "zxcvbn",
  "xyz",
  "xyzabc",
  "abc",
  "abcd",
  "abcde",
  "abcdef",
  "abc123",
  "xyz123",
  "xyzabc123",
  "test",
  "testing",
  "dummy",
  "random",
  "none",
  "nothing",
  "unknown",
  "null",
  "na",
  "n/a",
]);

function isMeaningless(value) {
  const text = value.trim().toLowerCase();

  if (!text) return true;

  const compact = text.replace(/\s+/g, "");

  if (!/[a-z\u00c0-\u024f\u0b80-\u0bff]/i.test(text)) {
    return true;
  }

  if (INVALID_WORDS.has(compact)) {
    return true;
  }

  if (/^(.)\1{3,}$/i.test(compact)) {
    return true;
  }

  if (/^(asdf|qwer|zxcv|abcd|1234|xyzabc)/i.test(compact)) {
    return true;
  }

  return false;
}

export default function PlantForm({ onSubmit, loading }) {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const busy = loading || pending;
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState("");
  const [revision, setRevision] = useState(0);

  // Image upload state
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true;

    setPeopleLoading(true);

    peopleApi
      .list()
      .then((data) => {
        if (active) {
          setPeople(data);
          setPeopleError("");
        }
      })
      .catch((err) => {
        if (active) {
          setPeopleError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setPeopleLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    const refresh = () => {
      setRevision((value) => value + 1);
    };

    window.addEventListener("hashchange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Create and clean up image preview
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    const imageUrl = URL.createObjectURL(image);
    setPreview(imageUrl);

    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [image]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setErrors((current) => ({
      ...current,
      image: "",
    }));

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImage(null);

      setErrors((current) => ({
        ...current,
        image: "Only JPG, PNG and WebP images are allowed.",
      }));

      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImage(null);

      setErrors((current) => ({
        ...current,
        image: "Image size must be 5 MB or less.",
      }));

      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setImage(null);

      setErrors((current) => ({
        ...current,
        image: "The selected image is empty.",
      }));

      event.target.value = "";
      return;
    }

    setImage(file);
  }

  function removeImage() {
    setImage(null);

    setErrors((current) => ({
      ...current,
      image: "",
    }));
  }

  function validate(data) {
    const newErrors = {};

    if (!data.plant_name) {
      newErrors.plant_name = "Plant name is required.";
    } else if (data.plant_name.length > 100) {
      newErrors.plant_name =
        "Plant name must be 100 characters or less.";
    } else if (isMeaningless(data.plant_name)) {
      newErrors.plant_name =
        "Invalid Plant Information. Enter a valid plant name.";
    }

    if (!data.plant_type) {
      newErrors.plant_type = "Please select a plant type.";
    } else if (!PLANT_TYPES.includes(data.plant_type)) {
      newErrors.plant_type = "Please select a valid plant type.";
    }

    if (data.location.length > 100) {
      newErrors.location =
        "Location must be 100 characters or less.";
    } else if (
      data.location &&
      isMeaningless(data.location)
    ) {
      newErrors.location =
        "Please enter a valid location or leave it empty.";
    }

    if (!data.symptom) {
      newErrors.symptom = "Please describe the symptoms.";
    } else if (data.symptom.length > 1000) {
      newErrors.symptom =
        "Symptoms must be 1000 characters or less.";
    } else if (
      data.symptom.length < 10 ||
      isMeaningless(data.symptom)
    ) {
      newErrors.symptom =
        "Invalid Plant Information. Describe meaningful plant symptoms.";
    }

    return newErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy || submitting.current) return;

    const cleaned = {
      plant_name: form.plant_name.trim(),
      plant_type: form.plant_type,
      location: form.location.trim(),
      symptom: form.symptom.trim(),
    };

    const newErrors = validate(cleaned);

    if (
      personId &&
      !people.some(
        (person) => person.id === Number(personId)
      )
    ) {
      newErrors.person =
        "Select an available person or choose Unassigned.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    submitting.current = true;
    setPending(true);
    try {
    await onSubmit(
      {
        ...cleaned,
        location: cleaned.location || null,
      },
      personId ? Number(personId) : null,
      image
    );
    } finally { submitting.current = false; setPending(false); }
  }

  return (
    <form
      className="card form-card"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="form-heading">
        <span className="form-icon">
          <Leaf size={24} />
        </span>

        <div>
          <h2>Analyze Your Plant</h2>
          <p className="form-subtitle">
            A little context helps your plant thrive.
          </p>
        </div>

        <span className="ai-badge">
          <Sparkles size={12} />
          AI powered
        </span>
      </div>

      <p className="muted">
        Tell us what’s growing. Fields marked * are required.
      </p>

      <div className="field">
        <label htmlFor="analysis-person">
          <Users size={15} />
          Select Person
          <span className="optional">(optional)</span>
        </label>

        <select
          id="analysis-person"
          value={personId}
          disabled={busy || peopleLoading}
          aria-invalid={Boolean(errors.person)}
          aria-describedby="person-help"
          onChange={(event) => {
            setPersonId(event.target.value);

            setErrors((current) => ({
              ...current,
              person: "",
            }));
          }}
        >
          <option value="">
            {peopleLoading ? "Loading people…" : "Unassigned"}
          </option>

          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {person.email ? ` (${person.email})` : ""}
            </option>
          ))}
        </select>

        <p className="muted" id="person-help">
          The saved plant will belong to this person.{" "}
          <a href="#people">Manage people</a>
        </p>

        {errors.person && (
          <span className="error" role="alert">
            {errors.person}
          </span>
        )}

        {peopleError && (
          <p className="error" role="alert">
            {peopleError}{" "}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setRevision((value) => value + 1)
              }
            >
              Retry
            </button>
          </p>
        )}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="plant_name">
            <Leaf size={15} />
            Plant Name <span>*</span>
          </label>

          <input
            id="plant_name"
            name="plant_name"
            type="text"
            placeholder="e.g. Tomato"
            value={form.plant_name}
            onChange={handleChange}
            disabled={busy}
            aria-invalid={Boolean(errors.plant_name)}
            aria-describedby={
              errors.plant_name
                ? "plant_name-error"
                : undefined
            }
            aria-required="true"
          />

          {errors.plant_name && (
            <span
              className="error"
              id="plant_name-error"
              role="alert"
            >
              {errors.plant_name}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="plant_type">
            <LayoutGrid size={15} />
            Plant Type <span>*</span>
          </label>

          <select
            id="plant_type"
            name="plant_type"
            value={form.plant_type}
            onChange={handleChange}
            disabled={busy}
            aria-invalid={Boolean(errors.plant_type)}
            aria-describedby={
              errors.plant_type
                ? "plant_type-error"
                : undefined
            }
            aria-required="true"
          >
            <option value="">Select plant type</option>

            {PLANT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {errors.plant_type && (
            <span
              className="error"
              id="plant_type-error"
              role="alert"
            >
              {errors.plant_type}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="location">
            <MapPin size={15} />
            Location
            <span className="optional">(optional)</span>
          </label>

          <input
            id="location"
            name="location"
            type="text"
            placeholder="e.g. Balcony, Garden, Colombo"
            value={form.location}
            onChange={handleChange}
            disabled={busy}
            aria-invalid={Boolean(errors.location)}
            aria-describedby={
              errors.location
                ? "location-error"
                : undefined
            }
          />

          {errors.location && (
            <span
              className="error"
              id="location-error"
              role="alert"
            >
              {errors.location}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="symptom">
            <FileText size={15} />
            Symptoms <span>*</span>
          </label>

          <textarea
            id="symptom"
            name="symptom"
            rows="5"
            placeholder="e.g. Leaves are turning yellow and have brown spots"
            value={form.symptom}
            onChange={handleChange}
            disabled={busy}
            aria-invalid={Boolean(errors.symptom)}
            aria-describedby={
              errors.symptom
                ? "symptom-error"
                : undefined
            }
            aria-required="true"
          />

          {errors.symptom && (
            <span
              className="error"
              id="symptom-error"
              role="alert"
            >
              {errors.symptom}
            </span>
          )}
        </div>
      </div>

      {/* Plant image upload */}
      <div className="field">
        <label htmlFor="plantImage">
          <ImagePlus size={17} />
          Plant / Leaf Image
          <span className="optional">(optional)</span>
        </label>

        <input
          id="plantImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={handleImageChange}
          aria-invalid={Boolean(errors.image)}
          aria-describedby={
            errors.image ? "plant-image-error" : undefined
          }
        />

        <p className="muted">
          Upload a clear plant or leaf photo.
          JPG, PNG or WebP. Maximum 5 MB.
        </p>

        {errors.image && (
          <span
            className="error"
            id="plant-image-error"
            role="alert"
          >
            {errors.image}
          </span>
        )}

        {preview && (
          <div
            style={{
              marginTop: "15px",
              padding: "12px",
              border: "1px solid #d5e5d8",
              borderRadius: "12px",
              background: "#f7fbf7",
            }}
          >
            <img
              src={preview}
              alt="Selected plant preview"
              style={{
                width: "100%",
                maxWidth: "300px",
                maxHeight: "250px",
                objectFit: "contain",
                borderRadius: "8px",
                display: "block",
              }}
            />

            <p className="muted">
              {image?.name}
            </p>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={removeImage}
            >
              <X size={16} />
              Remove Image
            </button>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy}
      >
        <Sparkles size={18} />
        {busy ? "Analyzing..." : "Analyze Plant"}
        {!busy && <ArrowUpRight size={18} />}
      </button>

      <p className="form-note">
        A little insight goes a long way.
        For educational use only.
      </p>
    </form>
  );
}
