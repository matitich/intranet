import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { dictionary, adjacencyGraphs } from "@zxcvbn-ts/language-common";
const estimator = new ZxcvbnFactory({ dictionary, graphs: adjacencyGraphs });
export function strongPassword(value: string) {
  return (
    value.length >= 12 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^a-zA-Z0-9]/.test(value) &&
    estimator.check(value).score >= 3 &&
    !["contraseña", "municipalidad", "password", "qwerty"].some((word) =>
      value.toLowerCase().includes(word),
    )
  );
}
