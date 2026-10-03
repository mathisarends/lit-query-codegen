import ts from "typescript";
import type { OpenAPIV3 } from "@scalar/openapi-types";
import type { CodegenConfig } from "./config.js";
import type { Operation, Operations } from "./operation.js";

const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

export function identifier(name: string, label: string): string {
  if (typeof name !== "string" || !/^[A-Za-z_$][\w$]*$/.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
  const token = ts
    .createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, name)
    .scan();
  if (token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastReservedWord) {
    throw new Error(`Reserved ${label}: ${name}`);
  }
  return name;
}

export function operationName(id: string | undefined): string {
  if (typeof id !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) {
    throw new Error(`Operation IDs must be explicit snake_case or camelCase identifiers: ${id}`);
  }
  const name = id.replace(/_([a-z0-9])/g, (_, character) => character.toUpperCase());
  return identifier(name, "operation name");
}

function resolveParameter(
  parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
  spec: OpenAPIV3.Document,
  seen = new Set<string>(),
): OpenAPIV3.ParameterObject {
  if (!("$ref" in parameter)) {
    return parameter;
  }
  const ref = parameter.$ref;
  if (!ref.startsWith("#/") || seen.has(ref)) {
    throw new Error(`Parameters require non-circular local references: ${ref}`);
  }
  seen.add(ref);
  let value: unknown = spec;
  for (const key of ref.slice(2).split("/")) {
    if (value === null || typeof value !== "object") {
      throw new Error(`Missing parameter reference: ${ref}`);
    }
    value = (value as Record<string, unknown>)[key.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  if (value === null || typeof value !== "object") {
    throw new Error(`Missing parameter reference: ${ref}`);
  }
  return resolveParameter(
    value as OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
    spec,
    seen,
  );
}

export function collectOperations(spec: OpenAPIV3.Document, config: CodegenConfig) {
  const operationsByTag = new Map<string, Operations>();
  const names = new Set<string>();
  const excluded = new Set(config.excludeTags ?? []);
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem) {
      continue;
    }
    if (pathItem.$ref) {
      throw new Error(`Path item references must be bundled before generation: ${path}`);
    }
    for (const [method, value] of Object.entries(pathItem)) {
      if (!methods.has(method)) {
        continue;
      }
      const operation = value as OpenAPIV3.OperationObject;
      if (operation.tags?.length !== 1) {
        throw new Error(`${method.toUpperCase()} ${path} needs exactly one OpenAPI tag`);
      }
      const [tag] = operation.tags;
      if (!/^[a-z][a-z0-9-]*$/.test(tag)) {
        throw new Error(`OpenAPI tag cannot be used as a feature directory: ${tag}`);
      }
      if (excluded.has(tag)) {
        continue;
      }
      const name = operationName(operation.operationId);
      if (names.has(name)) {
        throw new Error(`Duplicate generated operation name: ${name}`);
      }
      names.add(name);
      const operations = operationsByTag.get(tag) ?? new Map<string, Operation>();
      operations.set(name, {
        path,
        method,
        hasQuery: [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].some(
          (parameter) => resolveParameter(parameter, spec).in === "query",
        ),
      });
      operationsByTag.set(tag, operations);
    }
  }
  const mutationOperations = (config.mutationOperations ?? []).map(operationName);
  for (const name of mutationOperations) {
    if (!names.has(name)) {
      throw new Error(`Configured mutation has no included operation: ${name}`);
    }
  }
  for (const tag of new Set([
    ...Object.keys(config.features ?? {}),
    ...Object.keys(config.queryAliases ?? {}),
  ])) {
    if (!operationsByTag.has(tag)) {
      throw new Error(`Configured feature has no included operations: ${tag}`);
    }
  }
  return { operationsByTag, mutationOperations };
}
