#!/usr/bin/env node

import { getMonday } from './lib/dateUtils.js';

const dateArg = process.argv[2] || new Date;
const monday = getMonday(dateArg);

console.log(monday);
