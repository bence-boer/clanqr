<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>Ralph Agent Workspace</title>
</svelte:head>

<div class="app">
  <nav class="sidebar">
    <div class="logo">
      <h1>🤖 Ralph</h1>
      <span class="subtitle">Agent Workspace</span>
    </div>
    <ul class="nav-links">
      <li><a href="/">Dashboard</a></li>
      <li><a href="/projects">Projects</a></li>
      <li><a href="/monitoring">Monitoring</a></li>
    </ul>
  </nav>
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f0f;
    color: #e0e0e0;
  }

  .app {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 240px;
    background: #1a1a1a;
    border-right: 1px solid #2a2a2a;
    padding: 1.5rem 1rem;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    overflow-y: auto;
  }

  .logo h1 {
    font-size: 1.4rem;
    color: #fff;
  }

  .subtitle {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .nav-links {
    list-style: none;
    margin-top: 2rem;
  }

  .nav-links li {
    margin-bottom: 0.25rem;
  }

  .nav-links a {
    display: block;
    padding: 0.6rem 0.8rem;
    color: #aaa;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.9rem;
    transition: all 0.15s;
  }

  .nav-links a:hover {
    background: #252525;
    color: #fff;
  }

  .content {
    flex: 1;
    margin-left: 240px;
    padding: 2rem;
    max-width: 1200px;
  }
</style>
