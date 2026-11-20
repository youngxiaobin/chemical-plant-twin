precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uRain;
void main() {
  float ripple = sin(vUv.x * 46.0 + uTime * 1.5) * sin(vUv.y * 32.0 - uTime * 0.9);
  float crossRipple = sin((vUv.x + vUv.y) * 60.0 + uTime * 0.6);
  float mixRipple = ripple * 0.55 + crossRipple * 0.45;
  vec3 deep = vec3(0.03, 0.15, 0.18);
  vec3 light = vec3(0.22, 0.58, 0.6);
  vec3 color = mix(deep, light, 0.32 + mixRipple * 0.22 + uRain * 0.12);
  gl_FragColor = vec4(color, 0.84);
}
