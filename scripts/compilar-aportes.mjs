#!/usr/bin/env node
/* Junta todos los aportes aprobados (un archivo por aporte en data/aportes/<tipo>/)
   en un solo archivo data/aportes.json que lee el sitio.
   Uso:  node scripts/compilar-aportes.mjs           → genera data/aportes.json
         node scripts/compilar-aportes.mjs --check   → solo valida (lo usa la revisión de cada propuesta) */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const soloRevisar = process.argv.includes('--check');
const TIPOS = { personas: 'persona', fotos: 'foto', lugares: 'lugar', recuerdos: 'recuerdo' };
const familia = JSON.parse(readFileSync(join(raiz, 'data/familia.json'), 'utf8'));
const idsLibro = new Set(familia.personas.map(p => p.id));
const errores = [];
const salida = { generado: new Date().toISOString() };

for (const [carpeta, tipo] of Object.entries(TIPOS)) {
  const dir = join(raiz, 'data/aportes', carpeta);
  const lista = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      try {
        const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        if (!d.id) throw new Error('falta "id"');
        if (d.tipo && d.tipo !== tipo) throw new Error(`tipo "${d.tipo}" en la carpeta ${carpeta}`);
        if (tipo === 'persona' && !d.nombre) throw new Error('falta "nombre"');
        if (tipo === 'foto' && !d.archivo) throw new Error('falta "archivo"');
        if (tipo === 'recuerdo' && !d.texto) throw new Error('falta "texto"');
        for (const campo of ['archivo', 'foto']) {
          if (d[campo] && !existsSync(join(raiz, d[campo]))) throw new Error(`no existe la imagen ${d[campo]}`);
        }
        lista.push({ ...d, tipo });
      } catch (e) { errores.push(`data/aportes/${carpeta}/${f}: ${e.message}`); }
    }
  }
  lista.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  salida[carpeta] = lista;
}

// Referencias entre personas (padres/pareja) deben existir en el libro o en los aportes
const idsTodos = new Set([...idsLibro, ...salida.personas.map(p => p.id)]);
for (const p of salida.personas) {
  for (const r of [...(p.padres || []), ...(p.pareja || [])]) {
    if (!idsTodos.has(r)) errores.push(`persona ${p.id}: "${r}" no existe en el árbol`);
  }
}

if (errores.length) {
  console.error('Problemas encontrados:\n- ' + errores.join('\n- '));
  process.exit(1);
}
if (!soloRevisar) {
  writeFileSync(join(raiz, 'data/aportes.json'), JSON.stringify(salida, null, 1));
  console.log(`data/aportes.json: ${salida.personas.length} personas, ${salida.fotos.length} fotos, ${salida.lugares.length} lugares, ${salida.recuerdos.length} recuerdos`);
} else {
  console.log('Aportes válidos ✔');
}
