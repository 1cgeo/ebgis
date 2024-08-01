class MoveHandler {
    constructor(map, selectionManager, uiManager) {
        this.map = map;
        this.selectionManager = selectionManager;
        this.uiManager = uiManager;
        this.isDragging = false;
        this.lastPos = null;
        this.debounceTime = 30;
        this.lastUpdateTime = 0;
        this.map.on('mousedown', this.onMouseDown.bind(this));
    }

    onMouseDown(e) {
        this.startDrag(e);
        this.map.on('mousemove', this.onMouseMove.bind(this));
        this.map.once('mouseup', this.onMouseUp.bind(this));
    }

    startDrag(e) {
        const allSelectedFeatures = this.selectionManager.getAllSelectedFeatures();
        
        if (allSelectedFeatures.length > 0) {
            const clickedFeature = this.map.queryRenderedFeatures(e.point)[0];
            if(!clickedFeature){
                return
            }
            clickedFeature.id = clickedFeature.id || clickedFeature.properties.id

            if (allSelectedFeatures.some(f => f.id == clickedFeature.id)) {
                this.isDragging = true;
                this.map.dragPan.disable();
                this.initialCoordinates = e.lngLat;
                this.setCursorStyle('grabbing');

                this.selectedFeatures = allSelectedFeatures;
                this.offsets = new Map(allSelectedFeatures.map(item => [
                    item.id,
                    {
                        feature: item,
                        source: item.properties.source,
                        offset: this.calculateOffset(item, this.initialCoordinates)
                    }
                ]));
            }
        }
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const currentTime = performance.now();
        if (currentTime - this.lastUpdateTime < this.debounceTime) {
            return;
        }
        this.lastUpdateTime = currentTime;

        const newPos = e.lngLat;
        const dx = newPos.lng - this.initialCoordinates.lng;
        const dy = newPos.lat - this.initialCoordinates.lat;

        const updatedFeatures = this.selectedFeatures.map(feature => {
            const { offset } = this.offsets.get(feature.id);
            const newCoords = {
                lng: newPos.lng + offset[0],
                lat: newPos.lat + offset[1]
            };
            return this.calculateUpdatedFeature(feature, feature.properties.source, dx, dy, newCoords);
        });

        this.updateSelectionManagerFeatures(updatedFeatures);
    }

    onMouseUp(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.map.dragPan.enable();
        this.setCursorStyle('');

        const dx = e.lngLat.lng - this.initialCoordinates.lng;
        const dy = e.lngLat.lat - this.initialCoordinates.lat;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);
        const tolerance = 2 / Math.pow(2, this.map.getZoom());
        if (distanceMoved > tolerance) {
            this.selectionManager.updateSelectedFeatures(true);
        }

        this.map.off('mousemove', this.onMouseMove);
    }

    calculateUpdatedFeature(feature, source, dx, dy, newCoords) {
        let updatedFeature;
        switch (source) {
            case 'draw':
            case 'los':
            case 'visibility':
                updatedFeature = this.translateFeature(feature, dx, dy);
                break;
            case 'text':
            case 'image':
                updatedFeature = { ...feature, geometry: { ...feature.geometry, coordinates: [newCoords.lng, newCoords.lat] } };
                break;
            default:
                console.error('Unknown source type:', source);
                return feature;
        }
        return { ...updatedFeature, source };
    }

    calculateOffset(feature, referencePoint) {
        const coords = feature.geometry.coordinates;
    
        if (feature.geometry.type === "Point") {
            // For Point geometry
            return [
                coords[0] - referencePoint.lng,
                coords[1] - referencePoint.lat
            ];
        } else if (feature.geometry.type === "LineString") {
            // For LineString geometry (offset the first point)
            return [
                coords[0][0] - referencePoint.lng,
                coords[0][1] - referencePoint.lat
            ];
        } else if (feature.geometry.type === "Polygon") {
            // For Polygon geometry (offset the first point of the first ring)
            return [
                coords[0][0][0] - referencePoint.lng,
                coords[0][0][1] - referencePoint.lat
            ];
        } else if (feature.geometry.type === "MultiLineString") {
            // For MultiLineString geometry (offset the first point of the first line)
            return [
                coords[0][0][0] - referencePoint.lng,
                coords[0][0][1] - referencePoint.lat
            ];
        } else if (feature.geometry.type === "MultiPolygon") {
            // For MultiPolygon geometry (offset the first point of the first polygon)
            return [
                coords[0][0][0][0] - referencePoint.lng,
                coords[0][0][0][1] - referencePoint.lat
            ];
        } else {
            throw new Error("Unsupported geometry type: " + feature.geometry.type);
        }
    }

    translateFeature(feature, dx, dy) {
        const translatedFeature = JSON.parse(JSON.stringify(feature));
    
        const translateCoords = (coords) => {
            if (typeof coords[0] === 'number') {
                return [coords[0] + dx, coords[1] + dy];
            }
            return coords.map(translateCoords);
        };
    
        const { type, coordinates } = feature.geometry;
    
        switch (type) {
            case 'Point':
                translatedFeature.geometry.coordinates = translateCoords(coordinates);
                break;
            case 'LineString':
                translatedFeature.geometry.coordinates = coordinates.map(translateCoords);
                break;
            case 'Polygon':
                translatedFeature.geometry.coordinates = coordinates.map(ring => ring.map(translateCoords));
                break;
            case 'MultiLineString':
                translatedFeature.geometry.coordinates = coordinates.map(line => line.map(translateCoords));
                break;
            case 'MultiPolygon':
                translatedFeature.geometry.coordinates = coordinates.map(polygon => polygon.map(ring => ring.map(translateCoords)));
                break;
            default:
                throw new Error(`Unsupported geometry type: ${type}`);
        }
    
        return translatedFeature;
    }

    updateSelectionManagerFeatures(updatedFeatures) {
        const newSelectedFeatures = new Map();
        const newSelectedTextFeatures = new Map();
        const newSelectedImageFeatures = new Map();
        const newSelectedLOSFeatures = new Map();
        const newSelectedVisibilityFeatures = new Map();

        updatedFeatures.forEach(feature => {
            switch (feature.properties.source) {
                case 'draw':
                    newSelectedFeatures.set(feature.id, feature);
                    break;
                case 'text':
                    newSelectedTextFeatures.set(feature.id, feature);
                    break;
                case 'image':
                    newSelectedImageFeatures.set(feature.id, feature);
                    break;
                case 'los':
                    newSelectedLOSFeatures.set(feature.id, feature);
                    break;
                case 'visibility':
                    newSelectedVisibilityFeatures.set(feature.id, feature);
                    break;
            }
        });

        this.selectionManager.selectedDrawFeatures = newSelectedFeatures;
        this.selectionManager.selectedTextFeatures = newSelectedTextFeatures;
        this.selectionManager.selectedImageFeatures = newSelectedImageFeatures;
        this.selectionManager.selectedLOSFeatures = newSelectedLOSFeatures;
        this.selectionManager.selectedVisibilityFeatures = newSelectedVisibilityFeatures;
    }

    setCursorStyle(style) {
        this.map.getCanvas().style.cursor = style;
    }
}

export default MoveHandler;