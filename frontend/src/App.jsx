
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Leaf,
  Sprout,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  ClipboardList,
  ScanLine,
  HeartHandshake,
  AlertCircle,
} from "lucide-react";

import People from "./components/People.jsx";
import SavedAnalyses from "./components/SavedAnalyses.jsx";

import {
  listSavedAnalyses,
  importBrowserAnalyses,
  saveAnalysis,
  deleteAnalysis,
} from "./services/savedAnalyses.js";

import PlantIllustration from "./components/PlantIllustration.jsx";
import PlantForm from "./components/PlantForm.jsx";
import AnalysisResult from "./components/AnalysisResult.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";

import { analyzePlant } from "./services/plantService.js";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [plant, setPlant] = useState(null);
  const [result, setResult] = useState(null);

  // Image preview for the current analysis
  const [resultImage, setResultImage] = useState(null);

  useEffect(() => {
    return () => {
      if (resultImage) {
        URL.revokeObjectURL(resultImage);
      }
    };
  }, [resultImage]);

  const [analysisMeta, setAnalysisMeta] = useState(null);

  const [hash, setHash] = useState(
    () => window.location.hash
  );

  const [saved, setSaved] = useState({
    entries: [],
    error: "",
    warning: "",
    loading: true,
  });

  const [saving, setSaving] = useState(false);
  const analyzeInProgress = useRef(false);
  const saveInProgress = useRef(false);
  const refreshSequence = useRef(0);

  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const savedPage =
    hash === "#saved" || hash.startsWith("#saved/");

  const peoplePage = hash === "#people";

  const selectedId = hash.startsWith("#saved/")
    ? hash.slice(7)
    : null;

  const refreshSaved = useCallback(async () => {
    const sequence = ++refreshSequence.current;

    setSaved((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    const warning = await importBrowserAnalyses();

    try {
      const entries = await listSavedAnalyses();

      if (sequence === refreshSequence.current) {
        setSaved({
          entries,
          warning,
          error: "",
          loading: false,
        });
      }
    } catch (err) {
      if (sequence === refreshSequence.current) {
        setSaved({
          entries: [],
          warning,
          error: err.message,
          loading: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    function navigate() {
      setHash(window.location.hash);
    }

    window.addEventListener("hashchange", navigate);

    return () => {
      window.removeEventListener("hashchange", navigate);
    };
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved, savedPage]);

  useEffect(() => {
    if (!savedPage && !peoplePage) {
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({
        top: 0,
        behavior: "instant",
      });
    }
  }, [hash, savedPage, peoplePage]);

  async function handleSave() {
    if (
      !analysisMeta ||
      !plant ||
      !result ||
      saveInProgress.current
    ) {
      return;
    }

    saveInProgress.current = true;
    setSaving(true);
    setSaveError("");

    try {
      const entry = await saveAnalysis({
        ...analysisMeta,
        plant,
        result,
      });

      ++refreshSequence.current;

      setSaved((current) => ({
        ...current,
        error: "",
        loading: false,
        entries: [
          entry,
          ...current.entries.filter(
            (item) => item.id !== entry.id
          ),
        ],
      }));

      setSaveMessage(
        "Analysis saved to the database. Find it in Saved Analyses."
      );
    } catch (err) {
      setSaveMessage("");
      setSaveError(err.message);
    } finally {
      setSaving(false);
      saveInProgress.current = false;
    }
  }

  async function handleDelete(id) {
    await deleteAnalysis(id);

    ++refreshSequence.current;

    setSaved((current) => ({
      ...current,
      entries: current.entries.filter(
        (entry) => entry.id !== id
      ),
    }));

    setSaveMessage("");

    return true;
  }

  function analyzeFromSaved() {
    handleReset();
    window.location.hash = "analyze";
  }

  // Receive plant details, selected person and image
  async function handleAnalyze(
    plantData,
    personId,
    image = null
  ) {
    if (analyzeInProgress.current) return;
    analyzeInProgress.current = true;

    setPlant(null);
    setResult(null);
    setResultImage(null);
    setAnalysisMeta(null);

    setSaveMessage("");
    setSaveError("");
    setError("");
    setLoading(true);

    try {
      // Send plant details and optional image
      const data = await analyzePlant(
        plantData,
        image
      );

      // Create image preview after successful analysis
      if (image) {
        setResultImage(
          URL.createObjectURL(image)
        );
      }

      setPlant(plantData);
      setResult(data);

      setAnalysisMeta({
        person_id: personId,
        id:
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
        analyzedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(
        err.message || "Unable to analyze this plant."
      );
    } finally {
      analyzeInProgress.current = false;
      setLoading(false);
    }
  }

  function handleReset() {
    setResultImage(null);
    setPlant(null);
    setResult(null);
    setAnalysisMeta(null);

    setSaveMessage("");
    setSaveError("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="container nav-inner">
          <a href="#home" className="logo">
            <span className="logo-mark">
              <Sprout size={24} />
            </span>

            <span>Plant Health AI</span>
          </a>

          <nav aria-label="Main navigation">
            <a href="#home" className="nav-home">
              Home
            </a>

            <a href="#how-it-works">
              How it works
            </a>

            <a
              href="#people"
              className="nav-people"
              aria-current={
                peoplePage ? "page" : undefined
              }
            >
              People
            </a>

            <a
              href="#saved"
              className="nav-saved"
              aria-current={
                savedPage ? "page" : undefined
              }
            >
              Saved Analyses
            </a>

            <a
              href="#analyze"
              className="nav-cta"
            >
              Try plant analysis
              <ArrowUpRight size={16} />
            </a>
          </nav>
        </div>
      </header>

      <main>
        {savedPage && (
          <SavedAnalyses
            entries={saved.entries}
            selectedId={selectedId}
            storageError={saved.error}
            loading={saved.loading}
            importWarning={saved.warning}
            onRetry={refreshSaved}
            onDelete={handleDelete}
            onAnalyze={analyzeFromSaved}
          />
        )}

        {peoplePage && (
          <People onAnalyze={analyzeFromSaved} />
        )}

        <div hidden={savedPage || peoplePage}>
          <section
            className="hero"
            id="home"
          >
            <div className="container hero-inner">
              <div className="hero-text">
                <span className="eyebrow">
                  <span className="status-dot" />
                  A LITTLE SCIENCE. A LOT OF CARE.
                </span>

                <h1>
                  Smarter Plant Care,
                  <br />
                  <span>Powered by AI</span>
                </h1>

                <p>
                  Happy plants start with understanding.
                  Turn the symptoms you see into helpful
                  insights and simple steps for better
                  plant care.
                </p>

                <div className="hero-actions">
                  <a
                    href="#analyze"
                    className="btn btn-primary"
                  >
                    Analyze Your Plant
                    <ArrowUpRight size={19} />
                  </a>

                  <a
                    href="#how-it-works"
                    className="text-link"
                  >
                    See how it works
                    <ArrowRight size={17} />
                  </a>
                </div>

                <div className="hero-note">
                  <ShieldCheck size={17} />
                  No sign-up needed
                  <span>·</span>
                  Simple, educational guidance
                </div>
              </div>

              <div className="hero-visual">
                <div className="visual-orbit" />

                <span className="botanical-label">
                  GROW WITH CONFIDENCE
                </span>

                <PlantIllustration />

                <div className="floating-card insight-card">
                  <span className="mini-icon">
                    <ScanLine size={22} />
                  </span>

                  <div>
                    <strong>
                      A closer look. Better care.
                    </strong>

                    <small>
                      Plant insights, powered by AI
                    </small>
                  </div>

                  <span className="status-dot" />
                </div>

                <div className="floating-tag">
                  <Leaf size={17} />
                  Rooted in better care
                </div>

                <span className="visual-caption">
                  Every leaf tells a story. Let's
                  understand yours.
                </span>
              </div>
            </div>
          </section>

          <section
            className="how-section"
            id="how-it-works"
            aria-labelledby="how-title"
          >
            <div className="container how-inner">
              <div className="how-intro">
                <span className="eyebrow">
                  SIMPLE BY NATURE
                </span>

                <h2 id="how-title">
                  Better care in
                  <br />
                  three easy steps.
                </h2>
              </div>

              {[
                {
                  icon: ClipboardList,
                  title: "Enter plant details",
                  text:
                    "Tell us about your plant and what you've noticed.",
                },
                {
                  icon: Sparkles,
                  title: "Let AI take a look",
                  text:
                    "AI explores possible causes behind the symptoms.",
                },
                {
                  icon: HeartHandshake,
                  title: "Get care suggestions",
                  text:
                    "Find practical next steps to nurture your plant.",
                },
              ].map(
                ({ icon: Icon, title, text }, index) => (
                  <div
                    className="how-step"
                    key={title}
                  >
                    <div className="step-top">
                      <span className="step-icon">
                        <Icon size={22} />
                      </span>

                      <span className="step-number">
                        0{index + 1}
                      </span>
                    </div>

                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                )
              )}
            </div>
          </section>

          <section
            className="container analyze"
            id="analyze"
          >
            {error && (
              <div
                className="alert"
                role="alert"
              >
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {result ? (
              <AnalysisResult
                plant={plant}
                result={result}
                imagePreview={resultImage}
                onReset={handleReset}
                analyzedAt={
                  analysisMeta?.analyzedAt
                }
                onSave={handleSave}
                saving={saving}
                isSaved={saved.entries.some(
                  (entry) =>
                    entry.clientId ===
                    analysisMeta?.id
                )}
                saveMessage={saveMessage}
                saveError={saveError}
              />
            ) : (
              <div className="analysis-layout">
                <aside className="analysis-intro">
                  <span className="eyebrow">
                    <Leaf size={15} />
                    YOUR PLANT'S NEXT CHAPTER
                  </span>

                  <h2>
                    A little detail.
                    <br />
                    <span>
                      A healthier tomorrow.
                    </span>
                  </h2>

                  <p>
                    Yellowing leaves? Unexpected spots?
                    Let's get to the root of it,
                    together.
                  </p>

                  <div className="help-note">
                    <span className="mini-icon">
                      <Sprout size={23} />
                    </span>

                    <div>
                      <h3>
                        Good details make a difference
                      </h3>

                      <p>
                        Describe changes in leaf color,
                        texture, or growth. Include when
                        you first noticed them.
                      </p>
                    </div>
                  </div>

                  <div className="intro-footnote">
                    <ShieldCheck size={17} />

                    <span>
                      Thoughtful guidance for your
                      garden, balcony, and everything
                      in between.
                    </span>
                  </div>
                </aside>

                <div className="form-area">
                  <PlantForm
                    onSubmit={handleAnalyze}
                    loading={loading}
                  />

                  {loading && (
                    <LoadingSpinner
                      message="Analyzing your plant, please wait..."
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <a href="#home" className="logo">
            <Sprout size={23} />
            <span>Plant Health AI</span>
          </a>

          <p>
            © {new Date().getFullYear()} Plant Health AI.
            For educational use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
