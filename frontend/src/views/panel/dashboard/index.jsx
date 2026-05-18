import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Application, extend, useApplication, useTick } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import useTheme from "../../../hooks/useTheme";
import useZones from "../../../hooks/useZones";
import ZoneDialog from "./ZoneDialog";
import AgentDialog from "./AgentDialog";

extend({ Container, Graphics, Text });

// ---------------------------------------------------------------------------
// World / layout / theming
// ---------------------------------------------------------------------------

const TILE = 48;
const CELL_W = 12 * TILE; // 576
const CELL_H = 8 * TILE; //  384
const GAP = TILE; //          48
const ORIGIN_X = TILE;
const ORIGIN_Y = TILE;
const PITCH_X = CELL_W + GAP;
const PITCH_Y = CELL_H + GAP;

function snapToGrid(x, y) {
  const col = Math.max(0, Math.round((x - ORIGIN_X) / PITCH_X));
  const row = Math.max(0, Math.round((y - ORIGIN_Y) / PITCH_Y));
  return {
    x: ORIGIN_X + col * PITCH_X,
    y: ORIGIN_Y + row * PITCH_Y,
  };
}

function bboxesIntersect(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Calcula la transformación de cámara que centra el bbox de las zonas en
 * pantalla con un margen `padding`. Devuelve null si no hay zonas o si la
 * pantalla aún no se ha medido.
 *
 * El zoom nunca pasa de 1.0 (no ampliamos por encima del tamaño real) ni
 * baja de MIN_SCALE.
 */
function computeFitTransform(zones, screenW, screenH, padding = 80) {
  if (!zones.length || !screenW || !screenH) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const z of zones) {
    if (z.x < minX) minX = z.x;
    if (z.y < minY) minY = z.y;
    if (z.x + z.width > maxX) maxX = z.x + z.width;
    if (z.y + z.height > maxY) maxY = z.y + z.height;
  }
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  if (bboxW <= 0 || bboxH <= 0) return null;

  const availW = Math.max(1, screenW - padding * 2);
  const availH = Math.max(1, screenH - padding * 2);
  let scale = Math.min(availW / bboxW, availH / bboxH);
  scale = Math.min(1, Math.max(MIN_SCALE, scale));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: screenW / 2 - cx * scale,
    y: screenH / 2 - cy * scale,
    scale,
  };
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

const ZONE_COLOR = {
  research: 0x8b5cf6,
  build: 0x06b6d4,
  trade: 0x10b981,
  monitor: 0xf59e0b,
  security: 0xf43f5e,
  comms: 0x0ea5e9,
};

const STATUS_COLOR = {
  idle: 0x94a3b8,
  success: 0x10b981,
  warning: 0xf59e0b,
  error: 0xef4444,
};

function hexToInt(hex) {
  if (typeof hex !== "string") return null;
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  return m ? parseInt(m[1], 16) : null;
}

function resolveZoneColor(zone, fallback) {
  return hexToInt(zone.color) ?? ZONE_COLOR[zone.type] ?? fallback;
}

function themeColors(isDark) {
  return {
    accent: isDark ? 0x6366f1 : 0x4f46e5,
    error: 0xef4444,
    gridAlpha: isDark ? 0.06 : 0.08,
    bgRing: isDark ? 0x10141f : 0xffffff,
    zoneFillAlpha: isDark ? 0.1 : 0.07,
    zoneStrokeAlpha: 0.55,
    labelAlpha: 0.8,
    rowHighlightFill: isDark ? 0.1 : 0.07,
    rowHighlightStroke: 0.5,
    // Colores para nombres de agentes
    text: isDark ? 0xf1f5f9 : 0x0f172a,
    textDim: isDark ? 0x64748b : 0x94a3b8,
  };
}

// ---------------------------------------------------------------------------
// Pixi components
// ---------------------------------------------------------------------------

/**
 * Cuadrícula infinita dibujada en screen-space cada frame según la cámara.
 * Vive FUERA del Camera para no ser transformada.
 */
function InfiniteGrid({ cameraStateRef, accent, alpha }) {
  const { app } = useApplication();
  const gRef = useRef(null);

  useTick(() => {
    const g = gRef.current;
    if (!g || !app) return;
    const cam = cameraStateRef.current;
    const w = app.screen.width;
    const h = app.screen.height;
    const tileScreen = TILE * cam.scale;

    g.clear();
    if (tileScreen < 5) return; // demasiado denso para verse, ahorra GPU

    const firstCol = Math.floor(-cam.x / tileScreen);
    const lastCol = Math.ceil((w - cam.x) / tileScreen);
    for (let k = firstCol; k <= lastCol; k++) {
      const x = k * tileScreen + cam.x;
      g.moveTo(x, 0).lineTo(x, h);
    }
    const firstRow = Math.floor(-cam.y / tileScreen);
    const lastRow = Math.ceil((h - cam.y) / tileScreen);
    for (let j = firstRow; j <= lastRow; j++) {
      const y = j * tileScreen + cam.y;
      g.moveTo(0, y).lineTo(w, y);
    }
    g.stroke({ color: accent, alpha, width: 1 });
  });

  return <pixiGraphics ref={gRef} />;
}

/**
 * Banda horizontal que ilumina la fila destino mientras arrastras una zona,
 * y un contorno en la celda exacta de destino. Si el drop colisionaría con
 * otra zona (`d.forbidden`), se pinta en rojo.
 */
function RowHighlight({ dragRef, accent, error, fillAlpha, strokeAlpha }) {
  const gRef = useRef(null);

  useTick(() => {
    const g = gRef.current;
    if (!g) return;
    g.clear();
    const d = dragRef.current;
    if (!d || d.mode !== "zone") return;

    const snapped = snapToGrid(d.currentX, d.currentY);
    const PAD = TILE / 2;
    const bandX = -50000;
    const bandY = snapped.y - PAD;
    const bandW = 100000;
    const bandH = d.height + PAD * 2;

    const color = d.forbidden ? error : accent;
    const fa = d.forbidden ? 0.12 : fillAlpha;
    const sa = d.forbidden ? 0.7 : strokeAlpha;

    // banda de fila
    g.roundRect(bandX, bandY, bandW, bandH, 12);
    g.fill({ color, alpha: fa });
    g.stroke({ color, alpha: sa, width: 1 });

    // contorno de la celda destino
    g.roundRect(snapped.x, snapped.y, d.width, d.height, 8);
    g.stroke({ color, alpha: Math.min(1, sa + 0.25), width: 2 });
  });

  return <pixiGraphics ref={gRef} />;
}

/**
 * Zona renderizada. El contenedor se posiciona en cada frame:
 *  - si la zona está siendo arrastrada → usa dragRef.currentX/Y (live)
 *  - si no → usa zone.x / zone.y (de props, persistido en BD)
 *
 * Los agentes se nestean DENTRO de este container, así heredan su
 * transformación: cuando arrastras la zona, los agentes se mueven con ella
 * sin necesidad de actualizar sus posiciones manualmente.
 */
function Zone({
  zone,
  color,
  dragRef,
  agents,
  accent,
  ringColor,
  textColor,
  textDimColor,
  fillAlpha,
  strokeAlpha,
  labelAlpha,
  agentPositionsRef,
}) {
  const containerRef = useRef(null);
  const highlightRef = useRef(null);

  useTick(() => {
    const c = containerRef.current;
    if (!c) return;
    const d = dragRef.current;
    if (d?.mode === "zone" && d.zoneId === zone.id) {
      c.position.set(d.currentX, d.currentY);
      c.alpha = d.forbidden ? 0.4 : 0.85;
    } else {
      c.position.set(zone.x, zone.y);
      c.alpha = 1;
    }
    // Highlight cuando esta zona es target de un agent drag
    if (highlightRef.current) {
      const isAgentTarget =
        d?.mode === "agent" && d.targetZoneId === zone.id;
      highlightRef.current.alpha = isAgentTarget ? 1 : 0;
    }
  });

  const draw = useCallback(
    (g) => {
      g.clear();
      g.roundRect(0, 0, zone.width, zone.height, 8);
      g.fill({ color, alpha: fillAlpha });
      g.stroke({ color, alpha: strokeAlpha, width: 1 });
    },
    [zone.width, zone.height, color, fillAlpha, strokeAlpha]
  );

  // Highlight overlay (visible solo cuando es target de un agent drag)
  const drawHighlight = useCallback(
    (g) => {
      g.clear();
      g.roundRect(3, 3, zone.width - 6, zone.height - 6, 6);
      g.stroke({ color: accent, alpha: 0.9, width: 2 });
    },
    [zone.width, zone.height, accent]
  );

  const labelStyle = useMemo(
    () => ({
      fontFamily: '"JetBrains Mono Variable", monospace',
      fontSize: 11,
      fontWeight: "600",
      fill: color,
      letterSpacing: 1.5,
    }),
    [color]
  );

  return (
    <pixiContainer ref={containerRef}>
      <pixiGraphics draw={draw} />
      <pixiGraphics ref={highlightRef} draw={drawHighlight} alpha={0} />
      <pixiText
        text={
          (zone.kind === "controller" ? "★ " : "") +
          (zone.name || zone.type || "zone").toUpperCase()
        }
        x={12}
        y={10}
        alpha={labelAlpha}
        style={labelStyle}
      />
      {zone.kind === "controller" && (
        <pixiText
          text="ORQUESTADOR · CONSENSO Y REPARTO DE TAREAS"
          x={12}
          y={28}
          alpha={0.55}
          style={{
            fontFamily: '"JetBrains Mono Variable", monospace',
            fontSize: 9,
            fontWeight: "500",
            fill: color,
            letterSpacing: 1,
          }}
        />
      )}
      {agents?.map((a) => (
        <Agent
          key={a.id}
          id={a.id}
          zoneId={zone.id}
          zoneX={zone.x}
          zoneY={zone.y}
          name={a.name}
          initialX={a.x}
          initialY={a.y}
          status={a.status}
          currentActivity={a.currentActivity}
          loopEnabled={a.loopEnabled}
          loopIntervalSec={a.loopIntervalSec}
          lastTickAt={a.lastTickAt}
          wanderRadius={30}
          accent={accent}
          ringColor={ringColor}
          textColor={textColor}
          textDimColor={textDimColor}
          dragRef={dragRef}
          agentPositionsRef={agentPositionsRef}
        />
      ))}
    </pixiContainer>
  );
}

/**
 * Agente. Posicionado local a su zona (container hijo del zone container).
 * Si está siendo arrastrado, su posición local se ajusta para que
 * visualmente aparezca en (dragRef.currentWorldX, currentWorldY) del world.
 *
 * Hover (vía Pixi events): escala 1.2× con lerp suave, label brillante y
 * un anillo accent. No interfiere con el drag (manejado por DOM events).
 */
function Agent({
  id,
  zoneId,
  zoneX,
  zoneY,
  name,
  initialX,
  initialY,
  status,
  currentActivity,
  loopEnabled,
  loopIntervalSec,
  lastTickAt,
  wanderRadius,
  accent,
  ringColor,
  textColor,
  textDimColor,
  dragRef,
  agentPositionsRef,
}) {
  const isWorking = status === "working";
  const fillColor = isWorking ? accent : STATUS_COLOR[status] ?? STATUS_COLOR.idle;

  // Tick local cada 1s SOLO si tiene sentido mostrar cuenta atrás (loop
  // activo y no está trabajando). Evita timers innecesarios en el resto.
  const [now, setNow] = useState(() => Date.now());
  const needsCountdown = loopEnabled && !currentActivity;
  useEffect(() => {
    if (!needsCountdown) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [needsCountdown]);

  const activityLine = useMemo(() => {
    if (currentActivity) {
      return currentActivity.length > 28
        ? currentActivity.slice(0, 25) + "…"
        : currentActivity;
    }
    if (!loopEnabled) return null;
    if (!lastTickAt) return "tick pendiente";
    const intervalMs = (loopIntervalSec || 300) * 1000;
    const remaining = Math.max(
      0,
      new Date(lastTickAt).getTime() + intervalMs - now
    );
    if (remaining < 1000) return "tick inminente…";
    const s = Math.floor(remaining / 1000);
    if (s >= 60) return `tick en ${Math.floor(s / 60)}m ${s % 60}s`;
    return `tick en ${s}s`;
  }, [currentActivity, loopEnabled, loopIntervalSec, lastTickAt, now]);

  const containerRef = useRef(null);
  const haloRef = useRef(null);
  const hoverRingRef = useRef(null);
  const labelRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const stateRef = useRef({
    x: initialX,
    y: initialY,
    tx: initialX,
    ty: initialY,
    waitT: 0,
    pulseT: Math.random() * Math.PI * 2,
    scale: 1,
  });

  // Limpia el registro de hit-test cuando el agente se desmonta o cambia de id
  useEffect(() => {
    return () => {
      agentPositionsRef?.current?.delete(id);
    };
  }, [id, agentPositionsRef]);

  useTick((ticker) => {
    const s = stateRef.current;
    const d = dragRef?.current;
    const beingDragged = d?.mode === "agent" && d.agentId === id;

    if (beingDragged) {
      if (containerRef.current) {
        containerRef.current.position.set(
          d.currentWorldX - zoneX,
          d.currentWorldY - zoneY
        );
      }
      // Hover scale aún se aplica abajo para feedback consistente.
    } else {
      if (isWorking) {
        if (s.waitT > 0) {
          s.waitT -= ticker.deltaTime;
        } else {
          const dx = s.tx - s.x;
          const dy = s.ty - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1.5) {
            s.tx = initialX + (Math.random() - 0.5) * wanderRadius * 2;
            s.ty = initialY + (Math.random() - 0.5) * wanderRadius * 2;
            s.waitT = 30 + Math.random() * 90;
          } else {
            const speed = 0.35;
            s.x += (dx / dist) * speed * ticker.deltaTime;
            s.y += (dy / dist) * speed * ticker.deltaTime;
          }
        }
      }
      if (containerRef.current) {
        containerRef.current.position.set(s.x, s.y);
      }
      if (isWorking && haloRef.current) {
        s.pulseT += 0.045 * ticker.deltaTime;
        const cycle = ((s.pulseT % (Math.PI * 2)) / (Math.PI * 2)) % 1;
        haloRef.current.scale.set(1 + cycle * 1.2);
        haloRef.current.alpha = 0.55 * (1 - cycle);
      }
      if (agentPositionsRef?.current) {
        agentPositionsRef.current.set(id, { zoneId, x: s.x, y: s.y });
      }
    }

    // Hover scale con lerp suave
    if (containerRef.current) {
      const target = hovered || beingDragged ? 1.2 : 1;
      s.scale += (target - s.scale) * 0.2;
      containerRef.current.scale.set(s.scale);
    }
    if (hoverRingRef.current) {
      hoverRingRef.current.alpha = (hovered || beingDragged) ? 0.8 : 0;
    }
    if (labelRef.current) {
      labelRef.current.alpha = (hovered || beingDragged) ? 1 : 0.55;
    }
  });

  const drawBody = useCallback(
    (g) => {
      g.clear();
      // Torso (14×14, hombros redondeados)
      g.roundRect(-7, -1, 14, 14, 5);
      g.fill({ color: fillColor });
      g.stroke({ color: ringColor, width: 1.5 });
      // Cabeza (r=5)
      g.circle(0, -8, 5);
      g.fill({ color: fillColor });
      g.stroke({ color: ringColor, width: 1.5 });
    },
    [fillColor, ringColor]
  );

  const drawHalo = useCallback(
    (g) => {
      g.clear();
      g.roundRect(-10, -15, 20, 30, 11);
      g.stroke({ color: accent, width: 2 });
    },
    [accent]
  );

  const drawHoverRing = useCallback(
    (g) => {
      g.clear();
      g.roundRect(-12, -17, 24, 34, 13);
      g.stroke({ color: accent, alpha: 1, width: 1.5 });
    },
    [accent]
  );

  const labelStyle = useMemo(
    () => ({
      fontFamily: '"JetBrains Mono Variable", monospace',
      fontSize: 10,
      fontWeight: "600",
      fill: textColor ?? textDimColor ?? 0x94a3b8,
      letterSpacing: 0.5,
      align: "center",
    }),
    [textColor, textDimColor]
  );

  // Estilo de la línea de actividad: si está trabajando, usar accent y
  // peso medio (lo importante AHORA); si es countdown, mantenerlo discreto.
  const activityStyle = useMemo(
    () => ({
      fontFamily: '"JetBrains Mono Variable", monospace',
      fontSize: 9,
      fontWeight: currentActivity ? "600" : "400",
      fill: currentActivity ? accent : textDimColor ?? 0x64748b,
      letterSpacing: 0.4,
      align: "center",
    }),
    [accent, textDimColor, currentActivity]
  );

  return (
    <pixiContainer
      ref={containerRef}
      x={initialX}
      y={initialY}
      eventMode="static"
      onpointerover={() => setHovered(true)}
      onpointerout={() => setHovered(false)}
    >
      <pixiGraphics ref={hoverRingRef} draw={drawHoverRing} alpha={0} />
      {isWorking && <pixiGraphics ref={haloRef} draw={drawHalo} />}
      <pixiGraphics draw={drawBody} />
      {name && (
        <pixiText
          ref={labelRef}
          text={name}
          x={0}
          y={22}
          anchor={0.5}
          alpha={0.55}
          style={labelStyle}
        />
      )}
      {activityLine && (
        <pixiText
          text={activityLine}
          x={0}
          y={34}
          anchor={0.5}
          alpha={currentActivity ? 0.95 : 0.7}
          style={activityStyle}
        />
      )}
    </pixiContainer>
  );
}

/**
 * Container del mundo. Pura aplicación de la transformación de cámara en cada
 * frame. Sin event handling — eso lo hace EventManager.
 */
function CameraContainer({ stateRef, children }) {
  const containerRef = useRef(null);

  useTick(() => {
    const c = containerRef.current;
    if (!c) return;
    const s = stateRef.current;
    c.position.set(s.x, s.y);
    c.scale.set(s.scale);
  });

  return <pixiContainer ref={containerRef}>{children}</pixiContainer>;
}

/**
 * Gestor único de eventos DOM sobre el canvas. Decide entre:
 *  - pan de cámara (mousedown en zona vacía)
 *  - drag de zona  (mousedown sobre una zona, hit-test en world coords)
 *  - zoom (wheel, centrado en el cursor)
 *
 * No renderiza nada.
 */
// Umbral de movimiento (px de pantalla) para distinguir click de drag.
const CLICK_DRAG_THRESHOLD = 4;

function EventManager({
  zonesRef,
  cameraStateRef,
  dragRef,
  agentPositionsRef,
  onZoneMove,
  onZoneClick,
  onAgentMove,
  onAgentClick,
  onCameraChange,
}) {
  const { app, isInitialised } = useApplication();
  const onZoneMoveRef = useRef(onZoneMove);
  onZoneMoveRef.current = onZoneMove;
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;
  const onAgentMoveRef = useRef(onAgentMove);
  onAgentMoveRef.current = onAgentMove;
  const onAgentClickRef = useRef(onAgentClick);
  onAgentClickRef.current = onAgentClick;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  useEffect(() => {
    if (!isInitialised || !app) return;
    const canvas = app.canvas;
    canvas.style.cursor = "grab";

    const toWorld = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const cam = cameraStateRef.current;
      return {
        wx: (sx - cam.x) / cam.scale,
        wy: (sy - cam.y) / cam.scale,
        sx,
        sy,
      };
    };

    const hitZone = (wx, wy) => {
      const zs = zonesRef.current;
      // reverse: las últimas en el array están encima visualmente
      for (let i = zs.length - 1; i >= 0; i--) {
        const z = zs[i];
        if (
          wx >= z.x &&
          wx <= z.x + z.width &&
          wy >= z.y &&
          wy <= z.y + z.height
        ) {
          return z;
        }
      }
      return null;
    };

    // Algo mayor al bbox visual (~14px) para que clicks sean tolerantes.
    const AGENT_HIT_RADIUS = 18;
    const hitAgent = (wx, wy) => {
      const zs = zonesRef.current;
      for (let i = zs.length - 1; i >= 0; i--) {
        const z = zs[i];
        const ags = z.agents || [];
        for (let j = ags.length - 1; j >= 0; j--) {
          const a = ags[j];
          // Posición LIVE (con wander) si está registrada; si no, la stored.
          const pos = agentPositionsRef?.current?.get(a.id);
          const lx = pos?.x ?? a.x;
          const ly = pos?.y ?? a.y;
          const ax = z.x + lx;
          const ay = z.y + ly;
          const dist = Math.hypot(wx - ax, wy - ay);
          if (dist < AGENT_HIT_RADIUS) {
            return { agent: a, zone: z, worldX: ax, worldY: ay };
          }
        }
      }
      return null;
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      const { wx, wy } = toWorld(e.clientX, e.clientY);

      // 1) agentes (encima de zonas visualmente)
      const agentHit = hitAgent(wx, wy);
      if (agentHit) {
        dragRef.current = {
          mode: "agent",
          agentId: agentHit.agent.id,
          startWX: wx,
          startWY: wy,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startAgentWorldX: agentHit.worldX,
          startAgentWorldY: agentHit.worldY,
          originalZoneId: agentHit.zone.id,
          originalZoneX: agentHit.zone.x,
          originalZoneY: agentHit.zone.y,
          currentWorldX: agentHit.worldX,
          currentWorldY: agentHit.worldY,
          targetZoneId: agentHit.zone.id,
          moved: false,
        };
        canvas.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        return;
      }

      // 2) zonas
      const zoneHit = hitZone(wx, wy);
      if (zoneHit) {
        dragRef.current = {
          mode: "zone",
          zoneId: zoneHit.id,
          startWX: wx,
          startWY: wy,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startZoneX: zoneHit.x,
          startZoneY: zoneHit.y,
          currentX: zoneHit.x,
          currentY: zoneHit.y,
          width: zoneHit.width,
          height: zoneHit.height,
          moved: false,
          forbidden: false,
        };
      } else {
        // 3) camera
        dragRef.current = {
          mode: "camera",
          lastX: e.clientX,
          lastY: e.clientY,
        };
      }
      canvas.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    };

    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "camera") {
        const dx = e.clientX - d.lastX;
        const dy = e.clientY - d.lastY;
        d.lastX = e.clientX;
        d.lastY = e.clientY;
        cameraStateRef.current.x += dx;
        cameraStateRef.current.y += dy;
      } else if (d.mode === "agent") {
        if (!d.moved) {
          const dxs = e.clientX - d.startScreenX;
          const dys = e.clientY - d.startScreenY;
          if (Math.hypot(dxs, dys) < CLICK_DRAG_THRESHOLD) return;
          d.moved = true;
        }
        const { wx, wy } = toWorld(e.clientX, e.clientY);
        d.currentWorldX = d.startAgentWorldX + (wx - d.startWX);
        d.currentWorldY = d.startAgentWorldY + (wy - d.startWY);
        // Calcula zona destino — null si no está sobre ninguna.
        const target = hitZone(d.currentWorldX, d.currentWorldY);
        d.targetZoneId = target?.id ?? null;
        canvas.style.cursor = d.targetZoneId ? "grabbing" : "not-allowed";
      } else if (d.mode === "zone") {
        // Distinguir click (movimiento < umbral) de drag real.
        if (!d.moved) {
          const dxs = e.clientX - d.startScreenX;
          const dys = e.clientY - d.startScreenY;
          if (Math.hypot(dxs, dys) < CLICK_DRAG_THRESHOLD) return;
          d.moved = true;
        }

        const { wx, wy } = toWorld(e.clientX, e.clientY);
        d.currentX = d.startZoneX + (wx - d.startWX);
        d.currentY = d.startZoneY + (wy - d.startWY);

        // Comprueba colisión contra el resto de zonas en la posición snapeada.
        const snapped = snapToGrid(d.currentX, d.currentY);
        const target = {
          x: snapped.x,
          y: snapped.y,
          width: d.width,
          height: d.height,
        };
        d.forbidden = zonesRef.current.some(
          (z) => z.id !== d.zoneId && bboxesIntersect(z, target)
        );
        canvas.style.cursor = d.forbidden ? "not-allowed" : "grabbing";
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;

      if (d.mode === "agent") {
        if (!d.moved) {
          // Click puro: abrir edición
          onAgentClickRef.current?.(d.agentId);
        } else if (d.targetZoneId) {
          const target = zonesRef.current.find((z) => z.id === d.targetZoneId);
          if (target) {
            const localX = Math.round(d.currentWorldX - target.x);
            const localY = Math.round(d.currentWorldY - target.y);
            onAgentMoveRef.current?.(d.agentId, d.targetZoneId, localX, localY);
          }
        }
        // Si se soltó fuera de cualquier zona → no hace nada, snap-back
        // automático cuando dragRef sea null (Agent.useTick).
      } else if (d.mode === "zone") {
        if (!d.moved) {
          onZoneClickRef.current?.(d.zoneId);
        } else if (!d.forbidden) {
          const snapped = snapToGrid(d.currentX, d.currentY);
          if (snapped.x !== d.startZoneX || snapped.y !== d.startZoneY) {
            onZoneMoveRef.current?.(d.zoneId, snapped.x, snapped.y);
          }
        }
      } else if (d.mode === "camera") {
        onCameraChangeRef.current?.({ ...cameraStateRef.current });
      }

      dragRef.current = null;
      canvas.style.cursor = "grab";
      document.body.style.userSelect = "";
    };

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cam = cameraStateRef.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.scale * factor));
      const delta = newScale / cam.scale;
      cam.x = mx - (mx - cam.x) * delta;
      cam.y = my - (my - cam.y) * delta;
      cam.scale = newScale;
      onCameraChangeRef.current?.({ ...cam });
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.style.cursor = "";
    };
    // Solo re-attach si cambia la app/canvas. Las props se leen vía refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, isInitialised]);

  return null;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const Scene = forwardRef(function Scene(
  {
    isDark,
    zones,
    onZoneMove,
    onZoneClick,
    onAgentMove,
    onAgentClick,
    onCameraChange,
  },
  ref
) {
  const { app, isInitialised } = useApplication();
  const c = useMemo(() => themeColors(isDark), [isDark]);

  const cameraStateRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef(null);
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  // Map<agentId, { zoneId, x, y }> — escrito por cada Agent en useTick,
  // leído por EventManager para hit-testing preciso (live wandering).
  const agentPositionsRef = useRef(new Map());
  const initialFitDoneRef = useRef(false);

  const applyCamera = useCallback(
    (next) => {
      cameraStateRef.current.x = next.x;
      cameraStateRef.current.y = next.y;
      cameraStateRef.current.scale = next.scale;
      onCameraChange?.({ ...cameraStateRef.current });
    },
    [onCameraChange]
  );

  // Auto-fit al primer load: cuando las zonas llegan y la pantalla está
  // medida, centra y ajusta el zoom para que todo quepa con un margen.
  // Solo se hace una vez por montaje — los cambios posteriores (drag,
  // crear nueva zona…) no resetean la cámara.
  useEffect(() => {
    if (initialFitDoneRef.current) return;
    if (!isInitialised || !app?.screen) return;
    if (zones.length === 0) return;

    const fit = computeFitTransform(
      zones,
      app.screen.width,
      app.screen.height
    );
    if (!fit) return;
    applyCamera(fit);
    initialFitDoneRef.current = true;
  }, [zones, app, isInitialised, applyCamera]);

  // API imperativa para los botones de zoom del HUD
  useImperativeHandle(
    ref,
    () => ({
      zoomBy(factor, focalX, focalY) {
        const s = cameraStateRef.current;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s.scale * factor));
        const fx = focalX ?? (app?.screen.width ?? 0) / 2;
        const fy = focalY ?? (app?.screen.height ?? 0) / 2;
        const delta = newScale / s.scale;
        s.x = fx - (fx - s.x) * delta;
        s.y = fy - (fy - s.y) * delta;
        s.scale = newScale;
        onCameraChange?.({ ...s });
      },
      /**
       * Ajusta la cámara para que todas las zonas quepan en pantalla.
       * Si no hay zonas, vuelve a (0, 0, 1x).
       */
      fit() {
        const zs = zonesRef.current;
        if (zs.length === 0 || !app?.screen) {
          applyCamera({ x: 0, y: 0, scale: 1 });
          return;
        }
        const t = computeFitTransform(zs, app.screen.width, app.screen.height);
        applyCamera(t || { x: 0, y: 0, scale: 1 });
      },
      reset() {
        applyCamera({ x: 0, y: 0, scale: 1 });
      },
      getState() {
        return { ...cameraStateRef.current };
      },
    }),
    [app, applyCamera, onCameraChange]
  );

  return (
    <pixiContainer>
      <InfiniteGrid
        cameraStateRef={cameraStateRef}
        accent={c.accent}
        alpha={c.gridAlpha}
      />
      <EventManager
        zonesRef={zonesRef}
        cameraStateRef={cameraStateRef}
        dragRef={dragRef}
        agentPositionsRef={agentPositionsRef}
        onZoneMove={onZoneMove}
        onZoneClick={onZoneClick}
        onAgentMove={onAgentMove}
        onAgentClick={onAgentClick}
        onCameraChange={onCameraChange}
      />
      <CameraContainer stateRef={cameraStateRef}>
        <RowHighlight
          dragRef={dragRef}
          accent={c.accent}
          error={c.error}
          fillAlpha={c.rowHighlightFill}
          strokeAlpha={c.rowHighlightStroke}
        />
        {zones.map((zone) => (
          <Zone
            key={zone.id}
            zone={zone}
            color={resolveZoneColor(zone, c.accent)}
            dragRef={dragRef}
            agents={zone.agents || []}
            accent={c.accent}
            ringColor={c.bgRing}
            textColor={c.text}
            textDimColor={c.textDim}
            fillAlpha={c.zoneFillAlpha}
            strokeAlpha={c.zoneStrokeAlpha}
            labelAlpha={c.labelAlpha}
            agentPositionsRef={agentPositionsRef}
          />
        ))}
      </CameraContainer>
    </pixiContainer>
  );
});

// ---------------------------------------------------------------------------
// HUD primitives (React/HTML)
// ---------------------------------------------------------------------------

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const PlusIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const MinusIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const FitIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
  </svg>
);
const LayersIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="m12 2 10 6-10 6L2 8l10-6Z" />
    <path d="m2 14 10 6 10-6" />
  </svg>
);

function StatPill({ value, label, status = "working" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="status-dot" data-status={status} />
      <span className="mono text-[12px] tracking-tight">
        <span className="text-[color:var(--color-text)] font-semibold tabular-nums">
          {value}
        </span>
        <span className="text-[color:var(--color-text-muted)] ml-1 uppercase tracking-wider text-[10px]">
          {label}
        </span>
      </span>
    </div>
  );
}

function Sep() {
  return <span className="w-px h-4 bg-[color:var(--color-border)]" aria-hidden="true" />;
}

function LegendItem({ status, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="status-dot" data-status={status} />
      <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export default function PanelDashboardView() {
  const { isDark } = useTheme();
  const {
    zones,
    isLoading,
    error,
    createZone,
    updateZone,
    deleteZone,
    createAgent,
    updateAgent,
    deleteAgent,
  } = useZones();
  const containerRef = useRef(null);
  const cameraRef = useRef(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  // dialog: { mode: 'closed' } | { mode: 'create' } | { mode: 'edit', zoneId }
  const [dialog, setDialog] = useState({ mode: "closed" });
  const editingZone =
    dialog.mode === "edit" ? zones.find((z) => z.id === dialog.zoneId) : null;

  const openCreate = useCallback(() => setDialog({ mode: "create" }), []);
  const openEdit = useCallback(
    (zoneId) => setDialog({ mode: "edit", zoneId }),
    []
  );
  const closeDialog = useCallback(() => setDialog({ mode: "closed" }), []);

  // agentDialog: { mode: 'closed' } | { mode: 'create', zoneId } | { mode: 'edit', agentId }
  const [agentDialog, setAgentDialog] = useState({ mode: "closed" });
  const editingAgent = useMemo(() => {
    if (agentDialog.mode !== "edit") return null;
    for (const z of zones) {
      const a = (z.agents || []).find((a) => a.id === agentDialog.agentId);
      if (a) return a;
    }
    return null;
  }, [agentDialog, zones]);

  const openAgentCreate = useCallback(() => {
    // Default a la primera zona estándar (NO al orquestador). El orquestador
    // tiene su propio flujo: añadir agentes desde su ZoneDialog.
    const standardZones = zones.filter((z) => z.kind !== "controller");
    const defaultZoneId = standardZones[0]?.id || null;
    setAgentDialog({ mode: "create", zoneId: defaultZoneId });
  }, [zones]);
  const openAgentEdit = useCallback(
    (agentId) => setAgentDialog({ mode: "edit", agentId }),
    []
  );
  const closeAgentDialog = useCallback(
    () => setAgentDialog({ mode: "closed" }),
    []
  );

  const handleAgentSubmit = useCallback(
    async (payload) => {
      if (agentDialog.mode === "edit" && agentDialog.agentId) {
        await updateAgent(agentDialog.agentId, payload);
      } else {
        await createAgent(payload);
      }
    },
    [agentDialog, createAgent, updateAgent]
  );

  const handleAgentDelete = useCallback(async () => {
    if (agentDialog.mode !== "edit" || !agentDialog.agentId) return;
    await deleteAgent(agentDialog.agentId);
  }, [agentDialog, deleteAgent]);

  const handleAgentMove = useCallback(
    async (agentId, zoneId, x, y) => {
      try {
        await updateAgent(agentId, { zoneId, x, y });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to move agent:", err);
      }
    },
    [updateAgent]
  );

  const onCameraChange = useCallback((s) => {
    setZoomPercent(Math.round(s.scale * 100));
  }, []);

  // El número de agentes por zona sigue la misma fórmula que buildDemoAgents.
  const agentsCount = useMemo(
    () => zones.reduce((acc, z) => acc + (z.agents?.length || 0), 0),
    [zones]
  );

  const handleSubmit = useCallback(
    async (payload) => {
      if (dialog.mode === "edit" && dialog.zoneId) {
        await updateZone(dialog.zoneId, payload);
      } else {
        await createZone(payload);
      }
    },
    [dialog, createZone, updateZone]
  );

  const handleDelete = useCallback(async () => {
    if (dialog.mode !== "edit" || !dialog.zoneId) return;
    await deleteZone(dialog.zoneId);
  }, [dialog, deleteZone]);

  const handleZoneMove = useCallback(
    async (zoneId, x, y) => {
      try {
        await updateZone(zoneId, { x, y });
      } catch (err) {
        // useZones ya hace refetch para revertir el optimismo.
        // eslint-disable-next-line no-console
        console.error("Failed to move zone:", err);
      }
    },
    [updateZone]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[color:var(--color-bg)]"
    >
      <Application
        resizeTo={containerRef}
        backgroundAlpha={0}
        antialias
        autoDensity
        resolution={typeof window !== "undefined" ? window.devicePixelRatio : 1}
      >
        <Scene
          isDark={isDark}
          zones={zones}
          onZoneMove={handleZoneMove}
          onZoneClick={openEdit}
          onAgentMove={handleAgentMove}
          onAgentClick={openAgentEdit}
          onCameraChange={onCameraChange}
          ref={cameraRef}
        />
      </Application>

      {/* HUD — stats top-left */}
      <div className="absolute top-4 left-4 panel-floating !p-3 flex items-center gap-3">
        <StatPill value={agentsCount} label="agentes" status="working" />
        <Sep />
        <StatPill
          value={zones.length}
          label="zonas"
          status={zones.length > 0 ? "success" : "idle"}
        />
        <Sep />
        <StatPill value="247" label="tareas" status="info" />
        <Sep />
        <StatPill value="2" label="incidencias" status="warning" />
      </div>

      {/* HUD — acciones top-right */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button className="btn btn-secondary btn-sm" onClick={openCreate}>
          + Zona
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={zones.length === 0}
          onClick={openAgentCreate}
        >
          + Agente
        </button>
      </div>

      {/* HUD — leyenda bottom-left */}
      <div className="absolute bottom-4 left-4 panel-floating !px-3 !py-2 flex items-center gap-4">
        <LegendItem status="working" label="trabajando" />
        <LegendItem status="success" label="ok" />
        <LegendItem status="warning" label="atención" />
        <LegendItem status="error" label="error" />
        <LegendItem status="idle" label="inactivo" />
      </div>

      {/* HUD — zoom bottom-right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <div className="panel-floating !p-1 flex flex-col gap-1">
          <button
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="Acercar"
            title="Acercar"
            onClick={() => cameraRef.current?.zoomBy(1.2)}
          >
            <PlusIcon />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="Alejar"
            title="Alejar"
            onClick={() => cameraRef.current?.zoomBy(1 / 1.2)}
          >
            <MinusIcon />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="Ajustar a contenido"
            title="Ajustar a contenido"
            onClick={() => cameraRef.current?.fit()}
          >
            <FitIcon />
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm btn-icon panel-floating !p-0 !border-0 !w-9 !h-9"
          aria-label="Capas"
          title="Capas"
        >
          <LayersIcon />
        </button>
      </div>

      {/* HUD — telemetría inferior central */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 panel-floating !px-3 !py-1.5">
        <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          sim · zoom {zoomPercent}% · {TILE}px / tile
          {isLoading && " · cargando…"}
          {error && " · error al cargar zonas"}
        </span>
      </div>

      {/* Empty state */}
      {!isLoading && zones.length === 0 && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="panel-floating pointer-events-auto !p-6 text-center max-w-sm">
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
              office vacío
            </span>
            <h3 className="text-lg font-semibold tracking-tight mt-2">
              Crea tu primera zona
            </h3>
            <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
              Las zonas agrupan agentes que comparten contexto, MCPs y skills.
            </p>
            <button
              className="btn btn-primary btn-sm mt-4"
              onClick={openCreate}
            >
              + Crear zona
            </button>
          </div>
        </div>
      )}

      <ZoneDialog
        open={dialog.mode !== "closed"}
        mode={dialog.mode === "edit" ? "edit" : "create"}
        zone={editingZone}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />

      <AgentDialog
        open={agentDialog.mode !== "closed"}
        mode={agentDialog.mode === "edit" ? "edit" : "create"}
        agent={editingAgent}
        zones={zones}
        defaultZoneId={agentDialog.zoneId || null}
        onClose={closeAgentDialog}
        onSubmit={handleAgentSubmit}
        onDelete={handleAgentDelete}
      />
    </div>
  );
}
