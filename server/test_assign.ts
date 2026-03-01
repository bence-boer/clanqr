class Service {
    private state = 'active';
}
const s = new Service();
Object.assign(s, { state: 'idle' });
