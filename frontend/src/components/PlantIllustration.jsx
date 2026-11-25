export default function PlantIllustration() {
  return (
    <svg className="plant-illustration" viewBox="0 0 520 530" role="img" aria-labelledby="plant-art-title">
      <title id="plant-art-title">A lush green plant with broad leaves in a warm ceramic pot</title>
      <defs>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#70a97c" /><stop offset=".45" stopColor="#247453" /><stop offset="1" stopColor="#064e3b" /></linearGradient>
        <linearGradient id="leaf-light" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#bad49b" /><stop offset=".45" stopColor="#599c65" /><stop offset="1" stopColor="#176044" /></linearGradient>
        <linearGradient id="pot" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#c6c3ab" /><stop offset=".4" stopColor="#efeedc" /><stop offset=".7" stopColor="#e3e2ce" /><stop offset="1" stopColor="#b2b69d" /></linearGradient>
        <radialGradient id="halo"><stop stopColor="#d1fae5" /><stop offset="1" stopColor="#e6f1df" /></radialGradient>
        <filter id="ground"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <circle cx="268" cy="255" r="204" fill="url(#halo)" />
      <circle cx="268" cy="255" r="220" fill="none" stroke="#c9dec9" strokeDasharray="3 9" />
      <ellipse cx="268" cy="478" rx="111" ry="15" fill="#064e3b" opacity=".13" filter="url(#ground)" />
      <g fill="none" stroke="#316b45" strokeWidth="5" strokeLinecap="round">
        <path d="M262 390 Q253 236 272 113M263 357 Q212 260 158 201M262 358 Q296 267 374 233M260 327 Q301 209 365 152M259 317 Q227 180 198 125M261 373 Q227 326 165 296" />
      </g>
      <g stroke="#2d704a" strokeWidth=".7">
        <path d="M271 183 C221 160 230 76 291 48 C321 100 316 154 271 183Z" fill="url(#leaf-light)" />
        <path d="M241 236 C161 220 125 159 155 91 C224 102 259 154 241 236Z" fill="url(#leaf)" />
        <path d="M287 253 C278 178 336 114 414 118 C410 195 365 248 287 253Z" fill="url(#leaf)" />
        <path d="M222 295 C143 293 90 236 95 179 C172 168 232 217 222 295Z" fill="url(#leaf-light)" />
        <path d="M286 330 C289 250 367 209 435 230 C415 300 363 338 286 330Z" fill="url(#leaf-light)" />
        <path d="M247 357 C172 375 120 337 112 280 C177 259 236 293 247 357Z" fill="url(#leaf)" />
      </g>
      <g fill="none" stroke="#c1dba3" strokeWidth="1.4" opacity=".5">
        <path d="M271 180 Q278 119 290 56M242 235 Q198 164 157 99M288 251 Q348 177 408 123M221 293 Q163 219 101 185M289 329 Q356 269 429 232M244 355 Q181 311 119 283" />
        <path d="M198 168 L185 119M209 186 L170 174M343 184 L350 143M329 201 L376 184M165 232 L145 192M184 253 L133 237M354 274 L376 242M333 293 L388 286M184 320 L171 288" />
      </g>
      <ellipse cx="266" cy="375" rx="76" ry="17" fill="#c7c9b3" />
      <path d="M190 374 L206 461 Q266 490 326 461 L342 374Z" fill="url(#pot)" />
      <ellipse cx="266" cy="374" rx="76" ry="17" fill="#e8e8d6" />
      <ellipse cx="266" cy="374" rx="63" ry="10" fill="#4d5040" />
      <path d="M261 380 L261 359" stroke="#336443" strokeWidth="6" />
      <path d="M209 394 L219 450M220 398 L229 456M231 401 L239 459" stroke="#fff" opacity=".16" strokeWidth="3" />
    </svg>
  );
}
