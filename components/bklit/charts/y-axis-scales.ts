import { scaleLinear, scaleSymlog } from "@visx/scale";
import type { LineConfig } from "./chart-context";

/** Default axis id when `yAxisId` is omitted (Recharts-style `0` / primary left axis). */
export const DEFAULT_Y_AXIS_ID = "left";

export type YAxisOrientation = "left" | "right";

export function normalizeYAxisId(id?: string | number): string {
  if (id == null || id === "") {
    return DEFAULT_Y_AXIS_ID;
  }
  return String(id);
}

export function groupLinesByYAxisId(
  lines: LineConfig[]
): Map<string, LineConfig[]> {
  const groups = new Map<string, LineConfig[]>();
  for (const line of lines) {
    const axisId = normalizeYAxisId(line.yAxisId);
    const bucket = groups.get(axisId) ?? [];
    bucket.push(line);
    groups.set(axisId, bucket);
  }
  return groups;
}

type YScale = ReturnType<typeof scaleLinear<number>>;

export function getPrimaryYScale(
  yScales: Record<string, YScale>,
  fallback: YScale
): YScale {
  const primary = yScales[DEFAULT_Y_AXIS_ID];
  if (primary) {
    return primary;
  }
  const first = Object.values(yScales)[0];
  return first ?? fallback;
}

export type YScaleType = "linear" | "symlog" | "log";

function createSymlogScale(domain: [number, number], innerHeight: number): YScale {
  const scale = scaleSymlog({
    range: [innerHeight, 0],
    domain,
    constant: 1,
  }) as unknown as YScale;

  scale.ticks = (_count?: number) => {
    const [minVal, maxVal] = domain;
    const negTicks: number[] = [];
    if (minVal < 0) {
      let decade = -10;
      while (decade > minVal) {
        negTicks.unshift(decade);
        decade *= 10;
      }
      if (
        negTicks.length === 0 ||
        (negTicks[0] !== Math.round(minVal) && minVal < negTicks[0] * 1.25)
      ) {
        negTicks.unshift(Math.round(minVal));
      }
    }

    const posTicks: number[] = [];
    if (maxVal > 0) {
      let decade = 10;
      while (decade < maxVal) {
        posTicks.push(decade);
        decade *= 10;
      }
      if (
        posTicks.length === 0 ||
        (posTicks[posTicks.length - 1] !== Math.round(maxVal) &&
          maxVal > posTicks[posTicks.length - 1] * 1.25)
      ) {
        posTicks.push(Math.round(maxVal));
      }
    }

    return [...negTicks, 0, ...posTicks];
  };

  return scale;
}

export function buildYScalesForLines({
  lines,
  innerHeight,
  resolveDomain,
  scaleType = "linear",
}: {
  lines: LineConfig[];
  /** Passed by callers; domain is resolved via `resolveDomain`. */
  data?: Record<string, unknown>[];
  innerHeight: number;
  resolveDomain: (dataKeys: string[]) => [number, number];
  scaleType?: YScaleType;
}): Record<string, YScale> {
  const groups = groupLinesByYAxisId(lines);
  const scales: Record<string, YScale> = {};
  const isLog = scaleType === "symlog" || scaleType === "log";

  for (const [axisId, axisLines] of groups) {
    const dataKeys = axisLines.map((line) => line.dataKey);
    const domain = resolveDomain(dataKeys);
    scales[axisId] = isLog
      ? createSymlogScale(domain, innerHeight)
      : scaleLinear({
          range: [innerHeight, 0],
          domain,
          nice: true,
        });
  }

  if (!scales[DEFAULT_Y_AXIS_ID]) {
    scales[DEFAULT_Y_AXIS_ID] = isLog
      ? createSymlogScale([0, 100], innerHeight)
      : scaleLinear({
          range: [innerHeight, 0],
          domain: [0, 100],
          nice: true,
        });
  }

  return scales;
}

/** Build y-scales from pre-computed (already nice'd) domain endpoints. */
export function buildYScalesFromDomains({
  lines,
  innerHeight,
  domainsByAxis,
}: {
  lines: LineConfig[];
  innerHeight: number;
  domainsByAxis: Record<string, [number, number]>;
}): Record<string, YScale> {
  const groups = groupLinesByYAxisId(lines);
  const scales: Record<string, YScale> = {};

  for (const [axisId] of groups) {
    const domain =
      domainsByAxis[axisId] ??
      domainsByAxis[DEFAULT_Y_AXIS_ID] ??
      ([0, 100] as [number, number]);
    scales[axisId] = scaleLinear({
      range: [innerHeight, 0],
      domain,
    });
  }

  if (!scales[DEFAULT_Y_AXIS_ID]) {
    scales[DEFAULT_Y_AXIS_ID] = scaleLinear({
      range: [innerHeight, 0],
      domain: domainsByAxis[DEFAULT_Y_AXIS_ID] ?? [0, 100],
    });
  }

  return scales;
}

/** Single-axis charts (bar, scatter, candlestick, live line). */
export function wrapSingleYScale(yScale: YScale): Record<string, YScale> {
  return { [DEFAULT_Y_AXIS_ID]: yScale };
}
