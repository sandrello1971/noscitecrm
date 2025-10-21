---
cliente: "<% tp.file.folder(true).split('/').pop() %>"
tipo: "cliente"
tags: [cliente]
---

# 📌 Cliente: <% tp.file.folder(true).split('/').pop() %>


## ⚡ Azioni
```button
name ➕ Nuovo Progetto
type command
action QuickAdd: Nuovo Progetto
```

```button
name 📝 Nuovo Verbale
type command
action QuickAdd: Nuovo Verbale
```

```button
name 🗒️ Nuova Nota
type command
action QuickAdd: Nuova Nota Cliente
```
---

```dataviewjs
// Titolo dinamico: prende il nome della cartella (es. 10_Clienti/ACME → "ACME")
const folder = dv.current().file.folder;
const client = folder.split("/").pop();
dv.header(1, `Cliente: ${client}`);
dv.paragraph("[⟵ Torna a elenco clienti](../Clienti)");
```

---

## 📂 Progetti
```dataviewjs
const folder = dv.current().file.folder;
const rows = dv.pages(`"${folder}"`)
  .where(p => (p.tags ?? []).includes("progetto"))
  .sort(p => p.file.mtime, "desc")
  .map(p => [p.status ?? "", p.file.mtime, p.file.link]);
dv.table(["Status","Ultima modifica","Progetto"], rows);
```

## 📝 Verbali
```dataviewjs
const folder = dv.current().file.folder;
const rows = dv.pages(`"${folder}"`)
  .where(p => (p.tags ?? []).includes("verbale"))
  .sort(p => p.file.day ?? p.file.ctime, "desc")
  .map(p => [p.file.day ?? p.file.ctime, p.file.link]);
dv.table(["Data","Verbale"], rows);
```

## ✅ Task aperti del cliente
```dataviewjs
const folder = dv.current().file.folder;
const tasks = dv.pages(`"${folder}"`).file.tasks
  .where(t => !t.completed)
  .sort(t => t.due ?? t.created ?? t.line, "asc");
dv.taskList(tasks, true);
```

---

## 📌 Note del cliente
```dataviewjs
const folder = dv.current().file.folder;
const rows = dv.pages(`"${folder}"`)
  .where(p => !((p.tags ?? []).includes("progetto") || (p.tags ?? []).includes("verbale")))
  .where(p => p.file.name.toLowerCase() !== "readme")
  .sort(p => p.file.mtime, "desc")
  .map(p => p.file.link);
dv.list(rows);
```

---

### Istruzioni rapide
- I **progetti** devono avere il tag `progetto` (es. `tags: [progetto, prog/2025-acme-xyz]`).
- I **verbali** devono avere il tag `verbale` e, se vuoi, anche il tag progetto.
- Crea sempre i file **dentro questa cartella** del cliente: la dashboard li cattura da sola.
