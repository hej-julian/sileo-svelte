<div align="center">
  <h1>Sileo</h1>
  <p>An opinionated, physics-based toast component for Svelte.</p>
  <p><a href="https://sileo.aaryan.design">Try Out</a> &nbsp; / &nbsp; <a href="https://sileo.aaryan.design/docs">Docs</a></p>
  <video src="https://github.com/user-attachments/assets/a292d310-9189-490a-9f9d-d0a1d09defce"></video>
</div>

### Installation

```bash
npm i sileo-svelte
```

### Getting Started

```ts
// src/lib/sileo.ts
import { registerSileoElement, sileo } from "sileo-svelte/svelte";

registerSileoElement();

export { sileo };
```

```svelte
<script lang="ts">
  import { sileo } from "$lib/sileo";

  const notify = () => {
    sileo.success({ title: "Saved" });
  };
</script>

<sileo-toaster position="top-right" />
<button on:click={notify}>Show toast</button>
```

For detailed docs, click here: https://sileo.aaryan.design
