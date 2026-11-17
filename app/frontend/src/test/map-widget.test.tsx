import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MapWidget } from "../widgets/MapWidget";

const ol = vi.hoisted(() => ({
  maps: [] as any[],
  features: [] as any[],
  usePointsMock: vi.fn(),
  applyStyleMock: vi.fn((..._args: any[]) => Promise.resolve()),
}));

vi.mock("ol-mapbox-style", () => ({
  apply: (...args: unknown[]) => ol.applyStyleMock(...args),
}));

vi.mock("../entities/point/model/usePoints", () => ({
  usePoints: (...args: unknown[]) => ol.usePointsMock(...args),
}));

vi.mock("ol/Map", () => ({
  default: class MockMap {
    options: any;
    handlers = new Map<string, Function[]>();
    layers: any[] = [];
    target: any;
    size: any = [100, 100];
    featureAtPixel: any = null;

    constructor(options: any) {
      this.options = options;
      this.target = options.target;
      this.layers = [...options.layers];
      ol.maps.push(this);
    }

    view = { calculateExtent: () => [1, 2, 3, 4], animate: vi.fn() };
    getSize() { return this.size; }
    getView() { return this.view; }
    on(event: string, callback: Function) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
    }
    un(event: string, callback: Function) {
      this.handlers.set(event, (this.handlers.get(event) ?? []).filter((fn) => fn !== callback));
    }
    setTarget(target: any) { this.target = target; }
    setLayerGroup(group: any) { this.layers = [group]; }
    addLayer(layer: any) { this.layers.push(layer); }
    removeLayer(layer: any) { this.layers = this.layers.filter((item) => item !== layer); }
    forEachFeatureAtPixel(_pixel: any, callback: Function) {
      if (this.featureAtPixel) return callback(this.featureAtPixel);
      return undefined;
    }
    emit(event: string, payload: any = {}) {
      (this.handlers.get(event) ?? []).forEach((callback) => callback(payload));
    }
  },
}));

vi.mock("ol/View", () => ({
  default: class MockView {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/layer/Tile", () => ({
  default: class MockTileLayer {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/layer/Group", () => ({
  default: class MockLayerGroup {
    layers: any[] = [];
    getLayers() {
      const self = this;
      return {
        clear() { self.layers = []; },
        push(layer: any) { self.layers.push(layer); return self.layers.length; },
      };
    }
  },
}));

vi.mock("ol/source/OSM", () => ({
  default: class MockOSM {},
}));

vi.mock("ol/source/XYZ", () => ({
  default: class MockXYZ {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/layer/Vector", () => ({
  default: class MockVectorLayer {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/source/Vector", () => ({
  default: class MockVectorSource {
    features: any[] = [];
    addFeature(feature: any) { this.features.push(feature); }
  },
}));

vi.mock("ol/Feature", () => ({
  default: class MockFeature {
    values: any;
    constructor(values: any) {
      this.values = values;
      ol.features.push(this);
    }
    get(key: string) { return this.values[key]; }
  },
}));

vi.mock("ol/geom/Point", () => ({
  default: class MockPoint {
    constructor(public coordinates: any) {}
  },
}));

vi.mock("ol/style/Style", () => ({
  default: class MockStyle {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/style/Circle", () => ({
  default: class MockCircle {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/style/Fill", () => ({
  default: class MockFill {
    constructor(public options: any) {}
  },
}));

vi.mock("ol/proj", () => ({
  fromLonLat: (coordinates: number[]) => coordinates,
  toLonLat: (coordinates: number[]) => coordinates,
}));

const city = { id: "balakovo", name: "Балаково", latitude: 52.033, longitude: 47.783 };

const point = {
  id: 7,
  title: "Городское событие",
  description: "Описание",
  latitude: 51.5,
  longitude: 46.0,
  category_id: 1,
  category_name: "События",
  author_name: "Автор",
  event_at: "2026-01-01T12:00:00Z",
  status: "approved",
};

beforeEach(() => {
  vi.stubEnv("VITE_MAP_TILE_URL", "");
  vi.stubEnv("VITE_MAP_TILE_ATTRIBUTION", "");
  vi.stubEnv("VITE_MAP_STYLE_URL", "");
  vi.stubEnv("VITE_MAP_STYLE_URL_DARK", "");
  vi.stubEnv("VITE_MAPTILER_API_KEY", "");
});

describe("MapWidget", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MAP_TILE_URL", "");
    vi.stubEnv("VITE_MAP_TILE_ATTRIBUTION", "");
    vi.stubEnv("VITE_MAP_STYLE_URL", "");
    vi.stubEnv("VITE_MAP_STYLE_URL_DARK", "");
    vi.stubEnv("VITE_MAPTILER_API_KEY", "");
    delete document.documentElement.dataset.theme;
    ol.maps.length = 0;
    ol.features.length = 0;
    ol.usePointsMock.mockReset();
    ol.usePointsMock.mockReturnValue({
      data: [point],
      isFetching: false,
      isError: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("creates the map, loads points and selects a clicked marker", async () => {
    const onSelect = vi.fn();

    const { container, unmount } = render(
      <MapWidget categoryId={3} city={city} onSelect={onSelect} onMapClick={vi.fn()} />,
    );

    await waitFor(() => {
      expect(ol.usePointsMock).toHaveBeenCalledWith("1,2,3,4", 3);
    });

    const map = ol.maps[0];
    expect(map).toBeDefined();
    expect(map.target).toBe(container.querySelector(".map-canvas"));
    expect(map.layers).toHaveLength(2);
    expect(ol.features).toHaveLength(1);

    map.featureAtPixel = ol.features[0];
    map.emit("singleclick", { pixel: [10, 20] });

    expect(onSelect).toHaveBeenCalledWith(point);

    unmount();
    expect(map.target).toBeUndefined();
    expect(map.handlers.get("singleclick")).toHaveLength(0);
  });

  it("shows loading and error states", () => {
    ol.usePointsMock.mockReturnValue({
      data: undefined,
      isFetching: true,
      isError: true,
    });

    const { container } = render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

    expect(container.querySelector(".status")).toBeInTheDocument();
    expect(container.querySelector(".status.error")).toBeInTheDocument();
    expect(container.querySelector(".status")).toBeInTheDocument();
    expect(container.querySelector(".status.error")).toBeInTheDocument();
  });

  it("handles a map without a measurable size", async () => {
    render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

    const map = ol.maps[0];
    map.size = undefined;
    map.emit("moveend");

    expect(map.target).toBeTruthy();
  });

  it("does not select anything when a click misses all markers", async () => {
    const onSelect = vi.fn();

    render(<MapWidget city={city} onSelect={onSelect} onMapClick={vi.fn()} />);

    await waitFor(() => expect(ol.features).toHaveLength(1));

    ol.maps[0].featureAtPixel = null;
    ol.maps[0].emit("singleclick", { pixel: [0, 0], coordinate: [46.034, 51.533] });

    expect(onSelect).not.toHaveBeenCalled();
  });
});


it("removes the moveend handler on unmount", () => {
  ol.maps.length = 0;
  ol.features.length = 0;
  ol.usePointsMock.mockReturnValue({ data: [point], isFetching: false, isError: false });
  const { unmount } = render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);
  const map = ol.maps[0];

  expect(map.handlers.get("moveend")).toHaveLength(1);

  unmount();

  expect(map.handlers.get("moveend")).toHaveLength(0);
  expect(map.target).toBeUndefined();
});

it("uses a custom XYZ tile source when VITE_MAP_TILE_URL is set", () => {
  vi.stubEnv("VITE_MAP_TILE_URL", "https://tiles.example.com/{z}/{x}/{y}.png");
  vi.stubEnv("VITE_MAP_TILE_ATTRIBUTION", "© Tile provider");
  vi.stubEnv("VITE_MAP_STYLE_URL", "");
  ol.maps.length = 0;
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

  const baseSource = ol.maps[0].layers[0].layers[0].options.source;
  expect(baseSource.options.url).toBe("https://tiles.example.com/{z}/{x}/{y}.png");
  expect(baseSource.options.attributions).toBe("© Tile provider");

  vi.unstubAllEnvs();
});

it("applies a vector style when VITE_MAP_STYLE_URL is set", async () => {
  vi.stubEnv("VITE_MAP_TILE_URL", "");
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://api.example.com/style.json?key=test");
  ol.maps.length = 0;
  ol.applyStyleMock.mockClear();
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.applyStyleMock).toHaveBeenCalledWith(expect.anything(), "https://api.example.com/style.json?key=test"));

  vi.unstubAllEnvs();
});

it("falls back to a tile layer when the vector style fails to load", async () => {
  vi.stubEnv("VITE_MAP_TILE_URL", "");
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://api.example.com/broken-style.json");
  ol.maps.length = 0;
  ol.applyStyleMock.mockRejectedValueOnce(new Error("invalid key"));
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.maps[0].layers[0].layers.some((layer: any) => layer.options?.className === "base-map-layer")).toBe(true));

  vi.unstubAllEnvs();
});

it("injects the configured public key into a locally hosted style", async () => {
  vi.stubEnv("VITE_MAP_STYLE_URL", "/styles/map-light.json");
  vi.stubEnv("VITE_MAPTILER_API_KEY", "restricted-browser-key");
  ol.maps.length = 0;
  ol.applyStyleMock.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sources: { streets: { url: "https://tiles.example.com/tiles.json?key=__MAPTILER_KEY__" } } }),
  }));
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.applyStyleMock).toHaveBeenCalledWith(
    expect.anything(),
    { sources: { streets: { url: "https://tiles.example.com/tiles.json?key=restricted-browser-key" } } },
  ));

  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("applies the dark style when the dark theme is active", async () => {
  vi.stubEnv("VITE_MAP_TILE_URL", "");
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://api.example.com/light.json");
  vi.stubEnv("VITE_MAP_STYLE_URL_DARK", "https://api.example.com/dark.json");
  ol.maps.length = 0;
  ol.applyStyleMock.mockClear();
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });
  document.documentElement.dataset.theme = "dark";

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.applyStyleMock).toHaveBeenCalledWith(expect.anything(), "https://api.example.com/dark.json"));

  delete document.documentElement.dataset.theme;
  vi.unstubAllEnvs();
});

it("switches the map style when the theme changes", async () => {
  vi.stubEnv("VITE_MAP_TILE_URL", "");
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://api.example.com/light.json");
  vi.stubEnv("VITE_MAP_STYLE_URL_DARK", "https://api.example.com/dark.json");
  ol.maps.length = 0;
  ol.applyStyleMock.mockClear();
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });
  delete document.documentElement.dataset.theme;

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.applyStyleMock).toHaveBeenCalledWith(expect.anything(), "https://api.example.com/light.json"));

  document.documentElement.dataset.theme = "dark";

  await waitFor(() => expect(ol.applyStyleMock).toHaveBeenCalledWith(expect.anything(), "https://api.example.com/dark.json"));

  delete document.documentElement.dataset.theme;
  vi.unstubAllEnvs();
});

it("does not apply an outdated style after switching themes", async () => {
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://api.example.com/light.json");
  vi.stubEnv("VITE_MAP_STYLE_URL_DARK", "https://api.example.com/dark.json");
  ol.maps.length = 0;
  const pending = new Map<string, { group: any; resolve: () => void }>();
  ol.applyStyleMock.mockImplementation((group: any, style: string) => new Promise<void>(resolve => {
    pending.set(style, { group, resolve });
  }));
  ol.usePointsMock.mockReturnValue({ data: [], isFetching: false, isError: false });

  render(<MapWidget city={city} onSelect={vi.fn()} onMapClick={vi.fn()} />);
  await waitFor(() => expect(pending.has("https://api.example.com/light.json")).toBe(true));

  document.documentElement.dataset.theme = "dark";
  await waitFor(() => expect(pending.has("https://api.example.com/dark.json")).toBe(true));

  const darkRequest = pending.get("https://api.example.com/dark.json")!;
  darkRequest.resolve();
  await waitFor(() => expect(ol.maps[0].layers[0]).toBe(darkRequest.group));

  pending.get("https://api.example.com/light.json")!.resolve();
  await Promise.resolve();
  expect(ol.maps[0].layers[0]).toBe(darkRequest.group);

  delete document.documentElement.dataset.theme;
  vi.unstubAllEnvs();
});

it("does not select a marker missing from the current points data", async () => {
  ol.maps.length = 0;
  ol.features.length = 0;
  ol.usePointsMock.mockReturnValue({ data: [point], isFetching: false, isError: false });
  const onSelect = vi.fn();

  render(<MapWidget city={city} onSelect={onSelect} onMapClick={vi.fn()} />);

  await waitFor(() => expect(ol.features).toHaveLength(1));

  ol.maps[0].featureAtPixel = {
    get: (key: string) => key === "pointId" ? 999 : undefined,
  };

  ol.maps[0].emit("singleclick", { pixel: [10, 20], coordinate: [46.034, 51.533] });

  expect(onSelect).not.toHaveBeenCalled();
});
