import MapboxGL, { Map as MapboxMap, Marker, Popup } from "mapbox-gl";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import dateToISO from "../utils/dateToISO";

interface Props {
  className?: string;
  features?: Feature[];
  selectedFeature?: {
    id: string;
    centerMap: boolean;
  };
  onFeatureSelect?: (feature: { id: string; centerMap: boolean }) => void;
}

const Container = styled.div`
  &.mapboxgl-map {
    font: initial;
  }

  .mapboxgl-popup-content {
    background: #ee503d;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 1px 4px 0px rgba(0, 0, 0, 0.4);
    color: #ffffff;
  }

  .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
    border-bottom-color: #ee503d;
  }

  .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
    border-top-color: #ee503d;
  }

  .mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
    border-left-color: #ee503d;
  }

  .mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
    border-right-color: #ee503d;
  }
`;

// Use the correct map color scheme
const getMapColorScheme = () => {
  let scheme = "light";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    scheme = "dark";
  }
  return `mapbox://styles/mapbox/${scheme}-v10`;
};

// Store the currently selected feature id for reference
// When a new feature is selected we need to close the previous one's popup.
let currentlySelectedFeature = {
  id: "",
  centerMap: false,
};

const createMarker = (magnitude: number) => {
  // We set that 50px is the biggest circle for the strongest earthquakes (mag: 10)
  // Then round to the nearest pixel size
  const size = Math.round((magnitude / 10) * 50);

  const el = document.createElement("div");
  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: #ee503d;
    box-shadow: 0 1px 4px 0px rgba(0, 0, 0, 0.4);
  `;
  return el;
};

const createPopup = ({ id, properties }: Feature) => {
  const popup = new Popup({ closeButton: false, offset: 15 });
  popup.setHTML(`
    <b style="display: block; font-size: 24px; text-align: center;">
      ${properties.mag}
    </b>
    <small style="display: block; text-align: center; margin: 8px 0;">
      ${properties.place}
    </small>
    <small style="display: block; text-align: center;">
      ${dateToISO(new Date(properties.time))} ${new Date(properties.time).toTimeString().split(" ")[0]}
    </small>
  `);
  popup.on("close", () => {
    currentlySelectedFeature = { id: "", centerMap: false };
  });
  return popup;
};

MapboxGL.accessToken = __MAP_ACCESS_TOKEN__;

let map: MapboxMap;

const Map = (props: Props) => {
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    map = new MapboxMap({
      container: container.current,
      style: getMapColorScheme(),
    });

    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        map.setCenter([coords.longitude, coords.latitude]);
      },
      () => {
        // If position is not granted default to lat 0 long 0
        map.setCenter([0, 0]);
      }
    );

    map.setZoom(2);

    map.addControl(
      new MapboxGL.NavigationControl({
        showZoom: true,
      }),
      "bottom-right"
    );

    map.addControl(new MapboxGL.FullscreenControl({ container: document.body }));

    const setMapColorScheme = () => {
      map.setStyle(getMapColorScheme());
    };

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", setMapColorScheme);

    return () => {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", setMapColorScheme);
      map?.remove();
    };
  }, []);

  const [markers, setMarkers] = useState<Marker[]>([]);

  // Convert the features into markers that Mapbox understands
  useEffect(() => {
    if (map) {
      const newMarkers = props.features.map((feature) => {
        const marker = new Marker({
          element: createMarker(feature.properties.mag),
        })
          .setLngLat(feature.geometry.coordinates)
          .setPopup(createPopup(feature));

        marker.getElement().setAttribute("data-id", feature.id);
        marker.getElement().addEventListener("click", (event: Event) => {
          event.stopPropagation();
          props.onFeatureSelect?.({ id: feature.id, centerMap: false });
        });

        return marker;
      });

      setMarkers(newMarkers);
    }
  }, [props.features]);

  useEffect(() => {
    markers.forEach((marker) => marker.addTo(map));

    // For each new set of markers, remove old ones
    return () => markers.forEach((marker) => marker.remove());
  }, [markers]);

  useLayoutEffect(() => {
    let marker: Marker;

    const toggle = (featureId: string) => {
      marker = markers.find((marker) => marker.getElement().getAttribute("data-id") === featureId);
      marker?.togglePopup();
    };

    if (props.selectedFeature?.id) {
      toggle(currentlySelectedFeature.id);
      toggle(props.selectedFeature?.id);
      props.selectedFeature?.centerMap && map?.flyTo({ center: marker?.getLngLat() });
      currentlySelectedFeature = props.selectedFeature;
    }

    return () => toggle(currentlySelectedFeature.id);
  }, [props.selectedFeature]);

  return <Container className={props.className} ref={container} />;
};

export default Map;
