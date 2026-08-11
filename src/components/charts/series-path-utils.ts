import { line as d3Line } from "d3-shape";

// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

export interface SeriesPathPoint {
  x: number;
  y: number;
  key: string;
}

export function computeSeriesPathPoints(
  data: Record<string, unknown>[],
  xAccessor: (datum: Record<string, unknown>) => Date,
  xScale: (value: Date) => number | undefined,
  yScale: (value: number) => number | undefined,
  dataKey: string
): SeriesPathPoint[] {
  return data.map((datum, index) => {
    const xValue = xAccessor(datum);
    const yValue = datum[dataKey];
    const rawX = xScale(xValue);
    const rawY =
      typeof yValue === "number" && Number.isFinite(yValue)
        ? yScale(yValue)
        : undefined;
    const safeX = rawX != null && Number.isFinite(rawX) ? rawX : 0;
    const safeY = rawY != null && Number.isFinite(rawY) ? rawY : 0;
    return {
      x: safeX,
      y: safeY,
      key: String(xValue.getTime?.() ?? index),
    };
  });
}

export function interpolateSeriesPathPoints(
  from: SeriesPathPoint[],
  to: SeriesPathPoint[],
  progress: number
): SeriesPathPoint[] {
  if (progress >= 1) {
    return to;
  }
  if (progress <= 0) {
    return from.length > 0 ? from : to;
  }

  const fromByKey = new Map(from.map((point) => [point.key, point]));

  return to.map((target, index) => {
    const source = fromByKey.get(target.key);
    const previousTarget = index > 0 ? to[index - 1] : undefined;
    const previousSource = previousTarget
      ? fromByKey.get(previousTarget.key)
      : undefined;
    const nextTarget = index < to.length - 1 ? to[index + 1] : undefined;
    const nextSource = nextTarget ? fromByKey.get(nextTarget.key) : undefined;
    const anchor = source ?? previousSource ?? nextSource ?? from[0] ?? target;

    const x = anchor.x + (target.x - anchor.x) * progress;
    const y = anchor.y + (target.y - anchor.y) * progress;

    return {
      key: target.key,
      x: Number.isFinite(x) ? x : target.x,
      y: Number.isFinite(y) ? y : target.y,
    };
  });
}

export function seriesPathFromPoints(
  points: SeriesPathPoint[],
  curve: CurveFactory
): string {
  const validPoints = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (validPoints.length === 0) {
    return "";
  }

  const generator = d3Line<SeriesPathPoint>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curve);

  return generator(validPoints) ?? "";
}

export function seriesPathTransitionSignature({
  renderData,
  xAccessor,
  dataKey,
  innerWidth,
  xDomainMin,
  xDomainMax,
}: {
  renderData: Record<string, unknown>[];
  xAccessor: (datum: Record<string, unknown>) => Date;
  dataKey: string;
  innerWidth: number;
  xDomainMin: number;
  xDomainMax: number;
}): string {
  const values = renderData.map((datum) => {
    const xValue = xAccessor(datum);
    const yValue = datum[dataKey];
    return `${xValue.getTime()}:${typeof yValue === "number" ? yValue : ""}`;
  });

  return `${innerWidth}|${xDomainMin}|${xDomainMax}|${values.join(",")}`;
}
