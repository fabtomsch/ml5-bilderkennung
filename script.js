/* global ml5, Chart, ChartDataLabels */

const mobileNet = "MobileNet";

const examples = [
  {
    id: "Bee",
    group: "correct",
    title: "Bee",
    expected: "bee",
    expectedKeywords: ["bee"],
    src: "images/Biene.jpg",
    note: "Klares Foto einer Biene im Vordergrund"
  },
  {
    id: "Orca",
    group: "correct",
    title: "Orca",
    expected: "orca",
    expectedKeywords: ["orca", "whale"],
    src: "images/Wal.jpg",
    note: "Wal bzw. Orca außerhalb des Wassers"
  },
  {
    id: "banana",
    group: "correct",
    title: "Banane",
    expected: "banana",
    expectedKeywords: ["banana"],
    src: "images/banane.webp",
    note: "Form und Farbe sind typisch und gut erkennbar. Das Bild wurde künstlich angepasst."
  },
  {
    id: "Biber",
    group: "wrong",
    title: "Biber",
    expected: "beaver",
    expectedKeywords: ["beaver", "biber"],
    src: "images/Biber.jpg",
    note: "Der Biber ist erkennbar, aber Fell und Hintergrund haben ähnliche Farben."
  },
  {
    id: "dog",
    group: "wrong",
    title: "Hund",
    expected: "dog / dachshund",
    expectedKeywords: ["dog", "dachshund"],
    src: "images/dog.jpg",
    note: "Der Hund ist sichtbar, aber der Tennisball beeinflusst die Klassifikation."
  },
  {
    id: "Qualle",
    group: "wrong",
    title: "Qualle",
    expected: "jellyfish",
    expectedKeywords: ["jellyfish", "meduse"],
    src: "images/quallen-swarm.jpg",
    note: "Quallen heben sich nicht stark vom Hintergrund ab und werden deshalb schwerer erkannt."
  }
];

let classifier = null;
let modelReady = false;
let userImageLoaded = false;

const chartInstances = new Map();

document.addEventListener("DOMContentLoaded", init);

function init() {
  renderExampleCards();
  setupJumpButton();
  setupUploadInteraction();

  classifier = ml5.imageClassifier(mobileNet, () => {
    modelReady = true;

    setModelStatus("Modell geladen. Du kannst jetzt eigene Bilder hochladen.", "ok");

    const jumpButton = document.querySelector("#jump-to-upload");
    if (jumpButton) {
      jumpButton.classList.remove("hidden");
    }

    classifyAllExamples();
  });
}

function setupJumpButton() {
  const jumpButton = document.querySelector("#jump-to-upload");
  const uploadSection = document.querySelector("#upload-section");

  if (jumpButton && uploadSection) {
    jumpButton.addEventListener("click", () => {
      uploadSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
}

function renderExampleCards() {
  const correctContainer = document.querySelector("#correct-examples");
  const wrongContainer = document.querySelector("#wrong-examples");

  examples.forEach((item) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.id = `card-${item.id}`;

    card.innerHTML = `
      <div class="image-panel">
        <img id="img-${item.id}" alt="${escapeHtml(item.title)}" />

        <div class="meta">
          <strong>${escapeHtml(item.title)}</strong>
          <span>Erwartet: ${escapeHtml(item.expected)}</span>
          <span>${escapeHtml(item.note)}</span>
          <span id="badge-${item.id}" class="badge">Wartet auf Klassifikation …</span>
        </div>
      </div>

      <div class="chart-panel">
        <h4>Klassifikation</h4>

        <div class="chart-box">
          <canvas id="chart-${item.id}" aria-label="Balkendiagramm für ${escapeHtml(item.title)}"></canvas>
        </div>
      </div>
    `;

    const target = item.group === "correct" ? correctContainer : wrongContainer;
    target.appendChild(card);

    const img = card.querySelector("img");
    img.crossOrigin = "anonymous";
    img.src = item.src;
  });
}

async function classifyAllExamples() {
  for (const item of examples) {
    const img = document.querySelector(`#img-${item.id}`);
    const badge = document.querySelector(`#badge-${item.id}`);

    try {
      await waitForImage(img);

      const results = await classifyImage(img);
      const isCorrect = evaluatePrediction(results, item.expectedKeywords);

      badge.textContent = isCorrect
        ? "Korrekt klassifiziert"
        : "Falsch nicht korrekt klassifiziert";

      badge.className = `badge ${isCorrect ? "correct" : "wrong"}`;

      renderChart(`chart-${item.id}`, results, isCorrect ? "correct" : "wrong");
    } catch (error) {
      badge.textContent = "Fehler bei Bild oder Klassifikation";
      badge.className = "badge wrong";
      console.error(`Fehler bei ${item.title}:`, error);
    }
  }

  setModelStatus("Bereit. Du kannst jetzt eigene Bilder hochladen.", "ok");
}

function classifyImage(imgElement) {
  return new Promise((resolve, reject) => {
    if (!modelReady || !classifier) {
      reject(new Error("Das Modell ist noch nicht geladen."));
      return;
    }

    classifier.classify(imgElement, (error, results) => {
      if (error) {
        reject(error);
        return;
      }

      if (!results || results.length === 0) {
        reject(new Error("Keine Ergebnisse erhalten."));
        return;
      }

      resolve(results);
    });
  });
}

function evaluatePrediction(results, expectedKeywords) {
  const topLabel = String(results[0]?.label || "").toLowerCase();

  return expectedKeywords.some((keyword) =>
    topLabel.includes(keyword.toLowerCase())
  );
}

function renderChart(canvasId, results, semanticType = "correct") {
  const canvas = document.getElementById(canvasId);
  const topResults = results.slice(0, 3);

  const labels = topResults.map((result) => shortenLabel(result.label));
  const values = topResults.map((result) => toPercent(result));

  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
  }

  registerChartPlugin();

  let barColor = "rgba(35, 87, 214, 0.82)";

  if (semanticType === "correct") {
    barColor = "rgba(23, 128, 59, 0.82)";
  }

  if (semanticType === "wrong") {
    barColor = "rgba(180, 35, 24, 0.82)";
  }

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Confidence in %",
          data: values,
          backgroundColor: barColor,
          borderRadius: 8
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,

      layout: {
        padding: {
          right: 35
        }
      },

      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`
          }
        },
        y: {
          ticks: {
            font: {
              size: window.innerWidth < 700 ? 10 : 12
            }
          }
        }
      },

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.x.toFixed(2)}% Confidence`
          }
        },

        datalabels: {
          color: (context) => {
            const value = context.dataset.data[context.dataIndex];
            return value > 85 ? "white" : "#172033";
          },
          anchor: "end",
          align: (context) => {
            const value = context.dataset.data[context.dataIndex];
            return value > 85 ? "left" : "right";
          },
          offset: 6,
          clamp: true,
          formatter: (value) => `${value.toFixed(2)}%`,
          font: {
            weight: "bold"
          }
        }
      }
    }
  });

  chartInstances.set(canvasId, chart);
}

function renderPieChartWithOther(canvasId, results) {
  const canvas = document.getElementById(canvasId);

  const topResults = results.slice(0, 3);

  const labels = topResults.map((result) => shortenLabel(result.label));
  const values = topResults.map((result) => toPercent(result));

  const sumTopValues = values.reduce((sum, value) => sum + value, 0);
  const otherValue = Number(Math.max(0, 100 - sumTopValues).toFixed(2));

  labels.push("Andere");
  values.push(otherValue);

  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
  }

  registerChartPlugin();

  const chart = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Confidence in %",
          data: values,
          backgroundColor: [
            "#2f855a",
            "#3182ce",
            "#d69e2e",
            "#9ca3af"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            font: {
              size: window.innerWidth < 700 ? 10 : 12
            }
          }
        },

        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed.toFixed(2)}%`
          }
        },

        datalabels: {
          color: "white",
          formatter: (value) => {
            if (value < 3) {
              return "";
            }

            return `${value.toFixed(1)}%`;
          },
          font: {
            weight: "bold"
          }
        }
      }
    }
  });

  chartInstances.set(canvasId, chart);
}

function setupUploadInteraction() {
  const dropZone = document.querySelector("#drop-zone");
  const fileInput = document.querySelector("#file-input");
  const clearButton = document.querySelector("#clear-button");

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  });

  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  if (clearButton) {
    clearButton.addEventListener("click", resetUserUpload);
  }
}

function handleFile(file) {
  const feedback = document.querySelector("#upload-feedback");

  if (!modelReady) {
    showUploadFeedback("Bitte kurz warten. Das Modell wird noch geladen.", "info");
    return;
  }

  if (!file) {
    showUploadFeedback("Keine Datei ausgewählt.", "bad");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    showUploadFeedback("Dieses Dateiformat wird nicht unterstützt. Bitte JPG, PNG, GIF oder WebP verwenden.", "bad");
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  const userImage = document.querySelector("#user-image");
  const resultCard = document.querySelector("#user-result-card");

  userImageLoaded = false;

  userImage.onload = () => {
    userImageLoaded = true;
    URL.revokeObjectURL(imageUrl);

    resultCard.classList.remove("hidden");

    showUploadFeedback("Bild geladen. Die Klassifikation startet automatisch.", "ok");
    classifyUserImage();
  };

  userImage.onerror = () => {
    showUploadFeedback("Das Bild konnte nicht geladen werden.", "bad");
  };

  userImage.src = imageUrl;
  feedback.classList.remove("hidden");
}

async function classifyUserImage() {
  const userImage = document.querySelector("#user-image");

  if (!modelReady) {
    showUploadFeedback("Das Modell ist noch nicht bereit. Bitte kurz warten.", "info");
    return;
  }

  if (!userImageLoaded) {
    showUploadFeedback("Bitte zuerst ein gültiges Bild laden.", "bad");
    return;
  }

  try {
    showUploadFeedback("Bild wird klassifiziert …", "info");

    const results = await classifyImage(userImage);

    renderPieChartWithOther("user-chart", results);

    const top = results[0];
    showUploadFeedback(
      `Fertig. Top-Ergebnis: ${top.label} (${toPercent(top).toFixed(2)}%).`,
      "ok"
    );
  } catch (error) {
    console.error(error);
    showUploadFeedback("Bei der Klassifikation ist ein Fehler aufgetreten.", "bad");
  }
}

function resetUserUpload() {
  const userImage = document.querySelector("#user-image");
  const resultCard = document.querySelector("#user-result-card");
  const fileInput = document.querySelector("#file-input");

  userImageLoaded = false;
  userImage.removeAttribute("src");
  fileInput.value = "";

  resultCard.classList.add("hidden");

  if (chartInstances.has("user-chart")) {
    chartInstances.get("user-chart").destroy();
    chartInstances.delete("user-chart");
  }

  showUploadFeedback("Upload zurückgesetzt.", "info");
}

function waitForImage(img) {
  return new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }

    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => reject(new Error("Bild konnte nicht geladen werden.")), { once: true });
  });
}

function setModelStatus(message, type) {
  const status = document.querySelector("#model-status");

  status.textContent = message;
  status.className = `status ${type}`;
}

function showUploadFeedback(message, type) {
  const feedback = document.querySelector("#upload-feedback");

  feedback.textContent = message;
  feedback.className = `status ${type}`;
}

function toPercent(result) {
  const value = Number(result.confidence ?? result.probability ?? 0);

  if (value <= 1) {
    return Number((value * 100).toFixed(2));
  }

  return Number(value.toFixed(2));
}

function shortenLabel(label) {
  if (window.innerWidth < 700 && label.length > 22) {
    return label.substring(0, 19) + "...";
  }

  if (label.length > 38) {
    return label.substring(0, 35) + "...";
  }

  return label;
}

function registerChartPlugin() {
  if (typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}