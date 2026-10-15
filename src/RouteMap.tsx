import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Mapa OpenStreetMap via Leaflet dentro de um WebView: não precisa de chave do Google Maps.

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;background:#e8eef0}</style>
</head><body><div id="map"></div><script>
var map = L.map('map', { zoomControl: false }).setView([-15.78, -47.93], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
var line = L.polyline([], { color: '#0E7C66', weight: 5 }).addTo(map);
var start = null, here = null;
window.setRoute = function (pts, follow) {
  line.setLatLngs(pts);
  if (!pts.length) return;
  if (!start) start = L.circleMarker(pts[0], { radius: 6, color: '#fff', fillColor: '#0E7C66', fillOpacity: 1 }).addTo(map);
  else start.setLatLng(pts[0]);
  var last = pts[pts.length - 1];
  if (!here) here = L.circleMarker(last, { radius: 7, color: '#fff', fillColor: '#D9480F', fillOpacity: 1 }).addTo(map);
  else here.setLatLng(last);
  if (follow) map.setView(last, Math.max(map.getZoom(), 16));
  else if (pts.length > 1) map.fitBounds(line.getBounds(), { padding: [24, 24] });
  else map.setView(last, 16);
};
</script></body></html>`;

type Props = { points: [number, number][]; follow?: boolean; height?: number };

export function RouteMap({ points, follow = false, height = 260 }: Props) {
  const ref = useRef<WebView>(null);
  const loaded = useRef(false);

  const push = () => {
    if (!loaded.current) return;
    ref.current?.injectJavaScript(`window.setRoute(${JSON.stringify(points)}, ${follow}); true;`);
  };

  useEffect(push, [points, follow]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={ref}
        source={{ html: HTML }}
        originWhitelist={['*']}
        onLoadEnd={() => {
          loaded.current = true;
          push();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#e8eef0' },
});
