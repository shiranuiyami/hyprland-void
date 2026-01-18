#!/usr/bin/env node
/**
 * Generates build order based on package dependencies
 */

const fs = require('fs');
const path = require('path');

const repoName = process.env.REPO_NAME || 'hyprland-void';
const packages = new Map();

// Get non-symlink directories in srcpkgs
const srcpkgsPath = `/work/${repoName}/srcpkgs`;
const entries = fs.readdirSync(srcpkgsPath, { withFileTypes: true });

for (const entry of entries) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
        packages.set(entry.name, new Set());
    }
}

// Populate package dependency lists
for (const pkg of packages.keys()) {
    const required = [];
    let toNextLine = false;

    const templatePath = path.join(srcpkgsPath, pkg, 'template');
    const lines = fs.readFileSync(templatePath, 'utf8').split('\n');

    for (const line of lines) {
        // If the previous line contained "depends" and an opening quote mark, but not a closing one
        if (toNextLine) {
            let processLine = line;
            // If this line contains a closing quote mark
            if (line.includes('"')) {
                toNextLine = false;
                processLine = line.substring(0, line.indexOf('"'));
            }
            // Split line at any whitespace and add to the list
            processLine.split(/\s+/).forEach(dep => {
                if (dep) required.push(dep);
            });
        }

        // If line contains "depends" as a keyword and an opening quote mark
        if (line.includes('depends') && line.includes('"')) {
            let depends = line.substring(line.indexOf('"') + 1);
            if (!depends.includes('"')) {
                toNextLine = true;
            } else {
                depends = depends.substring(0, depends.indexOf('"'));
            }
            depends.split(/\s+/).forEach(dep => {
                if (dep) required.push(dep);
            });
        }
    }

    // Add dependency to this package's list if the dependency is also present in srcpkgs
    for (const dep of required) {
        if (packages.has(dep)) {
            packages.get(pkg).add(dep);
        }
    }
}

// Turn packages into an array so we can create a sorted array
const temp = Array.from(packages.keys());
const order = [];

// Build order based on dependencies
const inserted = new Set();

function insertPackage(pkg) {
    if (inserted.has(pkg)) return;

    const deps = packages.get(pkg);
    // Insert dependencies first
    for (const dep of deps) {
        insertPackage(dep);
    }

    order.push(pkg);
    inserted.add(pkg);
}

for (const pkg of temp) {
    insertPackage(pkg);
}

// Write build order to file
const buildOrderPath = '/work/build-order';
if (fs.existsSync(buildOrderPath)) {
    fs.unlinkSync(buildOrderPath);
}

console.log('Build Order:');
for (let i = 0; i < order.length; i++) {
    const pkg = order[i];
    const deps = Array.from(packages.get(pkg));
    console.log(`${i + 1}: ${pkg} - [${deps.join(', ')}]`);
    fs.appendFileSync(buildOrderPath, `${pkg}\n`);
}
