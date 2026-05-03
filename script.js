/* global ml5, Chart, ChartDataLabels */

const mobileNet = "MobileNet";

const examples = [
  {
    id: "Bee",
    group: "correct",
    title: "Bee",
    expected: "Bee",
    expectedKeywords: ["bee"],
    src: "images/Biene.jpg",
    note: "Klares Foto einer Biene im Vordergrund"
  },


  {
    id: "Orca",
    group: "correct",
    title: "Orca",
    expected: "Abstrakte Formen",
    expectedKeywords: ["orca","whale"],
    src: "images/Wal.jpg",
    note: "Wal - Orca, außerhalb des Wassers"
  },

  {
    id: "banana",
    group: "correct",
    title: "Banane",
    expected: "Banane",
    expectedKeywords: ["banana"],
    src: "images/banane.webp",
    note: "Form und Farbe sind typisch und gut erkennbar. Aber das Bild wurde künstlich angepasst"
  },

    {
    id: "Biber",
    group: "wrong",
    title: "Biber",
    expected: "beaver",
    expectedKeywords: ["beaver", "biber"],
    src: "images/Biber.jpg",
    note: "Biber ist vollem erkennbar. Fell und und Hintergrund haben ähnliche Farben"
  },

    {
    id: "dog",
    group: "wrong",
    title: "Hund",
    expected: "dog / dachshund",
    expectedKeywords: ["dog", "dachshund"],
    src: "images/dog.jpg",
    note: "Ein einzelnes Objekt steht deutlich im Vordergrund. Hat aber etwas bei sich. Der Tennisball wird erkannt aber der Hund nicht"
  },
  {
    id: "Qualle",
    group: "wrong",
    title: "Qualle",
    expected: "jellyfish",
    expectedKeywords: ["jellyfish", "meduse"],
    src: "images/Qualle.jpg",
    note: "Quallen die sich nicht stark vom Hintergrund abheben, werden nicht erkannt. Bzw. haben eine sehr geringe confidence. Das Bild zeigt eine Qualle vor einem dunklen Hintergrund, die sich kaum abhebt."
  }
];

let classifier = null;
let modelReady = false;
const chartInstances = new Map();
let userImageLoaded = false;

document.addEventListener("DOMContentLoaded", init);

function init() {
  renderExampleCards();
  setupJumpButton();

  classifier = ml5.imageClassifier(mobileNet, () => {
    modelReady = true;

    setModelStatus("Modell geladen. Du kannst jetzt eigene Bilder hochladen.", "ok");

    const jumpButton = document.querySelector("#jump-to-upload");
    if (jumpButton) {
      jumpButton.classList.remove("hidden");
    }

    classifyAllExamples();
  });

  setupUploadInteraction();
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
  return expectedKeywords.some((keyword) => topLabel.includes(keyword.toLowerCase()));
}

function renderChart(canvasId, results, semanticType = "correct") {
  const canvas = document.getElementById(canvasId);
  const labels = results.map((result) => result.label);
  const values = results.map((result) => Number((result.confidence * 100).toFixed(2)));

  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
  }

  Chart.register(ChartDataLabels);

  const barColor = semanticType === "correct"
    ? "rgba(23, 128, 59, 0.82)"
    : "rgba(180, 35, 24, 0.82)";

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
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`
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
          color: "#172033",
          anchor: "end",
          align: "right",
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
    renderChart("user-chart", results, "correct");
    const top = results[0];
    showUploadFeedback(`Fertig. Top-Ergebnis: ${top.label} (${(top.confidence * 100).toFixed(2)}%).`, "ok");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
