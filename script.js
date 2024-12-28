const tableBody = document.getElementById('pc-table');

// charge les donnees depuis l'api
function loadPCs() {
    fetch('api.php')
        .then(response => response.json())
        .then(data => {
            tableBody.innerHTML = ''; // vide le tableau
            data.forEach((pc, index) => {
                tableBody.innerHTML += 
                    `<tr>
                        <td>${index + 1}</td>
                        <td><img src="icons/${getCPUImage(pc.cpu)}" alt="${pc.cpu}">${pc.cpu}</td>
                        <td><img src="icons/${getGPUImage(pc.gpu)}" alt="${pc.gpu}">${pc.gpu}</td>
                        <td><img src="icons/${getStorageImage(pc.storage)}" alt="${pc.storage}">${pc.storage}</td>
                    </td>
                        <td><img src="icons/${getOSImage(pc.os)}" alt="${pc.os}">${pc.os}</td>
                        <td><img src="icons/${getBrandImage(pc.brand)}" alt="${pc.brand}">${pc.brand}</td>
                    </tr>`;
            });
        });
}

// ajt le nouv pc
function createNewPC() {
    const pc = {
        cpu: prompt('Entrez le CPU (ex: Intel Core i7 10700K)'),
        gpu: prompt('Entrez le GPU (ex: NVIDIA RTX 3060)'),
        storage: prompt('Entrez le stockage (ex: 1TB SSD)'),
        os: prompt('Entrez le système d\'exploitation (ex: Windows 10)'),
        brand: prompt('Entrez la marque et le modèle (ex: ASUS ROG Zephyrus)')
    };
    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pc)
    })
    .then(response => response.json())
    .then(() => loadPCs());
}

// suppr un pc
function deletePC() {
    const index = prompt('Entrez l\'index du PC à supprimer (1, 2, etc.)') - 1;
    if (index >= 0) {
        fetch(`api.php?index=${index}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(() => loadPCs());
    }
}

// modifi un oc
function modifyPC() {
    const index = prompt('Entrez l\'index du PC à modifier (1, 2, etc.)') - 1;
    if (index >= 0) {
        const pc = {
            cpu: prompt('Modifiez le CPU') || '',
            gpu: prompt('Modifiez le GPU') || '',
            storage: prompt('Modifiez le stockage') || '',
            os: prompt('Modifiez le système d\'exploitation') || '',
            brand: prompt('Modifiez la marque et le modèle') || ''
        };
        fetch(`api.php?index=${index}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pc)
        })
        .then(response => response.json())
        .then(() => loadPCs());
    }
}

// fonction pr recup les noms et icons et ca ctait chiant
function getCPUImage(cpu) {
    if (cpu.includes('i3')) return 'i3.png';
    if (cpu.includes('i5')) return 'i5.png';
    if (cpu.includes('i7')) return 'i7.png';
    if (cpu.includes('i9')) return 'i9.png';
    if (cpu.includes('INTEL')) return 'intel.png';
    if (cpu.includes('AMD')) return 'amd.png';
    return 'none.png';
}

function getGPUImage(gpu) {
    if (gpu.includes('INTEL')) return 'intel.png';
    if (gpu.includes('NVIDIA')) return 'nvidia.png';
    if (gpu.includes('AMD')) return 'amd.png';
    return 'none.png';
}

function getStorageImage(storage) {
    return storage.includes('HDD') ? 'hdd.png' : 'ssd.png';
}

function getOSImage(os) {
    if (os.includes('11')) return 'win11.png';
    if (os.includes('10')) return 'win10.png';
    if (os.includes('8.1')) return 'win81.png';
    if (os.includes('8')) return 'win8.png';
    if (os.includes('7')) return 'win7.png';
    if (os.includes('XP')) return 'winxp.png';
    if (os.includes('VISTA')) return 'winvista.png';
    if (os.includes('KALI')) return 'kali.png';
    if (os.includes('UBUNTU')) return 'ubuntu.png';
    if (os.includes('DEBIAN')) return 'debian.png';
    if (os.includes('FEDORA')) return 'fedora.png';
    if (os.includes('ARCH')) return 'arch.png';
    return 'none.png';
}

function getBrandImage(brand) {
    if (brand.includes('DELL')) return 'dell.png';
    if (brand.includes('ASUS')) return 'asus.png';
    if (brand.includes('MSI')) return 'msi.png';
    if (brand.includes('GIGABYTE')) return 'gigabyte.png';
    if (brand.includes('SAMSUNG')) return 'samsung.png';
    if (brand.includes('LENOVO')) return 'lenovo.png';
    if (brand.includes('HP')) return 'hp.png';
    if (brand.includes('ACER')) return 'acer.png';
    if (brand.includes('TOSHIBA')) return 'toshiba.png';
    if (brand.includes('APPLE')) return 'apple.png';
    return 'none.png';
}

loadPCs();