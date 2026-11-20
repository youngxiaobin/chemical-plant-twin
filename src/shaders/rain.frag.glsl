precision mediump float;
varying float vAlpha;
uniform float uStrength;
void main() {
  gl_FragColor = vec4(0.78, 0.88, 0.94, vAlpha * uStrength);
}
