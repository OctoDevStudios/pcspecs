const tableBody = document.getElementById("pc-table");

// charge les donnees depuis l'api
function loadPCs() {
  fetch("api.php")
    .then((response) => response.json())
    .then((data) => {
      tableBody.innerHTML = ""; // vide le tableau
      data.forEach((pc, index) => {
        tableBody.innerHTML += `<tr>
                        <td>${index + 1}</td>
                        <td><img src="icons/${getCPUImage(pc.cpu)}" alt="${
          pc.cpu
        }">${pc.cpu}</td>
                        <td><img src="icons/${getGPUImage(pc.gpu)}" alt="${
          pc.gpu
        }">${pc.gpu}</td>
                        <td><img src="icons/${getStorageImage(
                          pc.storage
                        )}" alt="${pc.storage}">${pc.storage}</td>
                    </td>
                        <td><img src="icons/${getOSImage(pc.os)}" alt="${
          pc.os
        }">${pc.os}</td>
                        <td><img src="icons/${getBrandImage(pc.brand)}" alt="${
          pc.brand
        }">${pc.brand}</td>
                    </tr>`;
      });
    });
}

// ajt le nouv pc
function createNewPC() {
  const pc = {
    cpu: prompt("Entrez le CPU (ex: Intel Core i7 10700K)"),
    gpu: prompt("Entrez le GPU (ex: NVIDIA RTX 3060)"),
    storage: prompt("Entrez le stockage (ex: 1TB SSD)"),
    os: prompt("Entrez le système d'exploitation (ex: Windows 10)"),
    brand: prompt("Entrez la marque et le modèle (ex: ASUS ROG Zephyrus)"),
  };
  fetch("api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pc),
  })
    .then((response) => response.json())
    .then(() => loadPCs());
}

// suppr un pc
function deletePC() {
  const index =
    parseInt(prompt("Entrez l'index du PC à supprimer (1, 2, etc.)")) - 1;
  if (!isNaN(index) && index >= 0) {
    fetch(`api.php?index=${index}`, { method: "DELETE" })
      .then((response) => response.json())
      .then(() => loadPCs());
  } else alert(`La valeur que vous avez donnée n'est pas un nombre valide`);
}

// modifi un oc
function modifyPC() {
  const index = prompt("Entrez l'index du PC à modifier (1, 2, etc.)") - 1;
  if (index >= 0) {
    const pc = {
      cpu: prompt("Modifiez le CPU") || "",
      gpu: prompt("Modifiez le GPU") || "",
      storage: prompt("Modifiez le stockage") || "",
      os: prompt("Modifiez le système d'exploitation") || "",
      brand: prompt("Modifiez la marque et le modèle") || "",
    };
    fetch(`api.php?index=${index}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pc),
    })
      .then((response) => response.json())
      .then(() => loadPCs());
  }
}

// fonction pr recup les noms et icons et ca ctait chiant
function getCPUImage(cpu) {
  return (
    (cpu.toUpperCase().includes("i3")
      ? "i3"
      : cpu.toUpperCase().includes("i5")
      ? "i5"
      : cpu.toUpperCase().includes("i7")
      ? "i7"
      : cpu.toUpperCase().includes("i9")
      ? "i9"
      : cpu.toUpperCase().includes("INTEL")
      ? "intel"
      : cpu.toUpperCase().includes("AMD")
      ? "amd"
      : "none") + ".png"
  );
}

function getGPUImage(gpu) {
  return (
    (gpu.toUpperCase().includes("INTEL")
      ? "intel"
      : gpu.toUpperCase().includes("NVIDIA")
      ? "nvidia"
      : gpu.toUpperCase().includes("AMD")
      ? "amd"
      : "none") + ".png"
  );
}

function getStorageImage(storage) {
  return (storage.toUpperCase().includes("HDD") ? "hdd" : "ssd") + ".png";
}

function getOSImage(os) {
  return (
    (os.toUpperCase().includes("11")
      ? "win11"
      : os.toUpperCase().includes("10")
      ? "win10"
      : os.toUpperCase().includes("8.1")
      ? "win81"
      : os.toUpperCase().includes("8")
      ? "win8"
      : os.toUpperCase().includes("7")
      ? "win7"
      : os.toUpperCase().includes("XP")
      ? "winxp"
      : os.toUpperCase().includes("VISTA")
      ? "winvista"
      : os.toUpperCase().includes("KALI")
      ? "kali"
      : os.toUpperCase().includes("UBUNTU")
      ? "ubuntu"
      : os.toUpperCase().includes("DEBIAN")
      ? "debian"
      : os.toUpperCase().includes("FEDORA")
      ? "fedora"
      : os.toUpperCase().includes("ARCH")
      ? "arch"
      : "none") + ".png"
  );
}

function getBrandImage(brand) {
  return (
    (brand.toUpperCase().includes("DELL")
      ? "dell"
      : brand.toUpperCase().includes("ASUS")
      ? "asus"
      : brand.toUpperCase().includes("MSI")
      ? "msi"
      : brand.toUpperCase().includes("GIGABYTE")
      ? "gigabyte"
      : brand.toUpperCase().includes("SAMSUNG")
      ? "samsung"
      : brand.toUpperCase().includes("LENOVO")
      ? "lenovo"
      : brand.toUpperCase().includes("HP")
      ? "hp"
      : brand.toUpperCase().includes("ACER")
      ? "acer"
      : brand.toUpperCase().includes("TOSHIBA")
      ? "toshiba"
      : brand.toUpperCase().includes("APPLE")
      ? "apple"
      : "none") + ".png"
  );
}

loadPCs();
