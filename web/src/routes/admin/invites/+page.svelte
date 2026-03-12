<script lang="ts">
    import { api } from '$lib/api/client';
    import type { InviteToken } from '$lib/types';
    import { onMount } from 'svelte';
    import InviteForm from './InviteForm.svelte';
    import InviteTable from './InviteTable.svelte';

    let invites: InviteToken[] = $state([]);
    let invites_loading = $state(true);

    async function load_invites() {
        invites_loading = true;
        try {
            invites = await api.list_invites();
        }
        catch {
            // Errors handled by subcomponents or toast store
        }
        finally {
            invites_loading = false;
        }
    }

    onMount(() => {
        load_invites();
    });
</script>

<InviteForm oninvite_created={load_invites} />
<InviteTable bind:invites {invites_loading} />
