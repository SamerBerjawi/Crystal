declare module 'xss' {
  type XssValue = string | number | boolean | null | undefined;
  function xss(value: XssValue): string;
  export default xss;
}
