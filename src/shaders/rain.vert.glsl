varying float vAlpha;
void main() {
  vAlpha = 0.55;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
