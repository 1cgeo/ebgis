import { saveToFile, loadFromFile } from './utils.js';
import store, { getCurrentBaseLayer } from './store.js';

class SaveLoadControl {
    constructor(mapControl, baseLayerControl) {
        this.mapControl = mapControl;
        this.baseLayerControl = baseLayerControl;
    }

    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl-group mapboxgl-ctrl save-load-control';
        this.container.innerHTML = `
            <button id="save-btn" class="save-load-icon">
                <img src="./images/icon_save_black.svg" alt="SAVE" />
            </button>
            <button id="load-btn" class="save-load-icon">
                <img src="./images/icon_load_black.svg" alt="LOAD" />
            </button>
            <input type="file" id="load-file" style="display: none;" />
        `;

        this.container.querySelector('#save-btn').addEventListener('click', () => {
            const allData = {
                maps: store.maps,
                currentMap: store.currentMap,
            };
            saveToFile(allData, 'maps_data.json');
        });

        this.container.querySelector('#load-btn').addEventListener('click', () => {
            this.container.querySelector('#load-file').click();
        });

        this.container.querySelector('#load-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                loadFromFile(file, (data) => {
                    // Atualize o store com os dados carregados
                    store.maps = data.maps;
                    store.currentMap = data.currentMap;

                    // Atualize o mapa para refletir os dados carregados
                    const baseLayer = getCurrentBaseLayer();
                    this.baseLayerControl.switchLayer(baseLayer);

                    // Atualize a lista de mapas no mapControl
                    this.mapControl.updateMapList();
                });
            }
        });

        $('input[name="base-layer"]').on('change', this.changeButtonColors);
        this.changeButtonColors()

        return this.container;
    }

    changeButtonColors = () => {
        const color = $('input[name="base-layer"]:checked').val() == 'Carta' ? 'black' : 'white'
        $("#load-btn").html(`<img src="./images/icon_load_${color}.svg" alt="LOAD" />`);
        $("#save-btn").html(`<img src="./images/icon_save_${color}.svg" alt="SAVE" />`);
    }

    onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
        $('input[name="base-layer"]').off('change', this.changeButtonColor);
    }
}

export default SaveLoadControl;
