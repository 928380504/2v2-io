import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const configurationPath = path.join(root, "site", "game-filters.json");
const catalogPath = path.join(root, "site", "content", "game-catalog-data.ts");
const errors = [];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ATTRIBUTE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return "";
}

function objectProperty(object, name) {
  return object.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) && propertyName(property.name) === name,
  );
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isSatisfiesExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function stringValues(node, label) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { values: [node.text], scalar: true };
  }
  if (ts.isArrayLiteralExpression(node)) {
    const values = [];
    for (const element of node.elements) {
      if (!ts.isStringLiteral(element) && !ts.isNoSubstitutionTemplateLiteral(element)) {
        errors.push(`${label} must contain string literals only.`);
        continue;
      }
      values.push(element.text);
    }
    return { values, scalar: false };
  }
  errors.push(`${label} must be a string or string array literal.`);
  return { values: [], scalar: false };
}

let configuration;
try {
  configuration = JSON.parse(fs.readFileSync(configurationPath, "utf8"));
} catch (error) {
  console.error(`ERROR site/game-filters.json: ${error.message}`);
  process.exit(1);
}

if (configuration.schemaVersion !== 1) {
  errors.push("site/game-filters.json must use schemaVersion 1.");
}
if (!Array.isArray(configuration.groups) || configuration.groups.length === 0) {
  errors.push("site/game-filters.json must define at least one group.");
}

const groupKeys = new Set();
const attributeKeys = new Set();
const generatorKeys = new Set();
const optionSlugs = new Set();
const groupsByAttribute = new Map();

for (const [index, group] of (configuration.groups || []).entries()) {
  const label = `groups[${index}]`;
  if (!SLUG.test(group.key || "")) errors.push(`${label}.key must be a slug.`);
  if (!SLUG.test(group.generatorKey || "")) {
    errors.push(`${label}.generatorKey must be a command-line slug.`);
  }
  if (!ATTRIBUTE_KEY.test(group.attributeKey || "")) {
    errors.push(`${label}.attributeKey must be a valid JavaScript property name.`);
  }
  if (!group.label || !group.icon) errors.push(`${label} requires label and icon.`);
  if (groupKeys.has(group.key)) errors.push(`Duplicate group key: ${group.key}.`);
  if (attributeKeys.has(group.attributeKey)) {
    errors.push(`Duplicate attributeKey: ${group.attributeKey}.`);
  }
  if (generatorKeys.has(group.generatorKey)) {
    errors.push(`Duplicate generatorKey: ${group.generatorKey}.`);
  }
  groupKeys.add(group.key);
  attributeKeys.add(group.attributeKey);
  generatorKeys.add(group.generatorKey);
  groupsByAttribute.set(group.attributeKey, group);

  if (!Array.isArray(group.options) || group.options.length === 0) {
    errors.push(`${label}.options must not be empty.`);
    continue;
  }
  const localSlugs = new Set();
  for (const [optionIndex, option] of group.options.entries()) {
    if (!SLUG.test(option.slug || "")) {
      errors.push(`${label}.options[${optionIndex}].slug must be a slug.`);
    }
    if (!option.label || !option.description) {
      errors.push(`${label}.options[${optionIndex}] requires label and description.`);
    }
    if (optionSlugs.has(option.slug)) {
      errors.push(`Option slugs must be globally unique: ${option.slug}.`);
    }
    optionSlugs.add(option.slug);
    localSlugs.add(option.slug);
  }
  for (const field of ["defaultValues", "generatorDefaultValues"]) {
    if (!Array.isArray(group[field])) {
      errors.push(`${label}.${field} must be an array.`);
      continue;
    }
    if (group.multiple === false && group[field].length > 1) {
      errors.push(`${label}.${field} may contain at most one value.`);
    }
    group[field].forEach((value) => {
      if (!localSlugs.has(value)) errors.push(`${label}.${field} contains unknown option: ${value}.`);
    });
  }
}

if (!groupKeys.has(configuration.primaryMatchGroup)) {
  errors.push("primaryMatchGroup must reference an existing group key.");
}
for (const [alias, target] of Object.entries(configuration.aliases || {})) {
  if (!SLUG.test(alias)) errors.push(`Alias must be a slug: ${alias}.`);
  if (!optionSlugs.has(target)) errors.push(`Alias ${alias} targets unknown option: ${target}.`);
}

let catalogSource = "";
try {
  catalogSource = fs.readFileSync(catalogPath, "utf8");
} catch (error) {
  errors.push(`Cannot read game catalog: ${error.message}`);
}

if (catalogSource) {
  const sourceFile = ts.createSourceFile(
    catalogPath,
    catalogSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let definitions;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    node.declarationList.declarations.forEach((declaration) => {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "GAME_DEFINITIONS" &&
        declaration.initializer
      ) {
        const initializer = unwrapExpression(declaration.initializer);
        if (ts.isObjectLiteralExpression(initializer)) definitions = initializer;
      }
    });
  });
  if (!definitions) {
    errors.push("GAME_DEFINITIONS object could not be parsed from the game catalog.");
  } else {
    for (const gameProperty of definitions.properties) {
      if (!ts.isPropertyAssignment(gameProperty) || !ts.isObjectLiteralExpression(gameProperty.initializer)) {
        continue;
      }
      const gameId = propertyName(gameProperty.name) || "unknown game";
      const attributesProperty = objectProperty(gameProperty.initializer, "gameAttributes");
      if (!attributesProperty || !ts.isObjectLiteralExpression(attributesProperty.initializer)) {
        // Legacy or deliberately hidden catalog entries may rely on runtime defaults.
        continue;
      }
      const seenAttributes = new Set();
      for (const attribute of attributesProperty.initializer.properties) {
        if (!ts.isPropertyAssignment(attribute)) continue;
        const attributeKey = propertyName(attribute.name);
        const group = groupsByAttribute.get(attributeKey);
        seenAttributes.add(attributeKey);
        if (!group) {
          errors.push(`${gameId}.gameAttributes contains unconfigured key: ${attributeKey}.`);
          continue;
        }
        const { values, scalar } = stringValues(
          attribute.initializer,
          `${gameId}.gameAttributes.${attributeKey}`,
        );
        if (group.multiple === false && !scalar) {
          errors.push(`${gameId}.gameAttributes.${attributeKey} must be a scalar string.`);
        }
        if (group.multiple !== false && scalar) {
          errors.push(`${gameId}.gameAttributes.${attributeKey} must be a string array.`);
        }
        const allowed = new Set(group.options.map((option) => option.slug));
        values.forEach((value) => {
          if (!allowed.has(value)) {
            errors.push(`${gameId}.gameAttributes.${attributeKey} contains unknown value: ${value}.`);
          }
        });
      }
      for (const group of configuration.groups || []) {
        if (!seenAttributes.has(group.attributeKey)) {
          errors.push(`${gameId}.gameAttributes is missing configured key: ${group.attributeKey}.`);
        }
      }
    }
  }
}

if (errors.length) {
  errors.forEach((message) => console.error(`ERROR ${message}`));
  console.error(`Game filter validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `Game filters passed: ${configuration.groups.length} groups, ${optionSlugs.size} options.`,
);
