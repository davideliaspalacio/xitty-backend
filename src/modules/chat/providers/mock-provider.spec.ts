import { MockChatProvider } from './mock-provider';
import { ChatProviderMessage } from './chat-provider.interface';

describe('MockChatProvider', () => {
  let provider: MockChatProvider;

  beforeEach(() => {
    provider = new MockChatProvider();
  });

  function msg(content: string): ChatProviderMessage[] {
    return [{ role: 'user', content }];
  }

  it('responde sobre Playa Salgar cuando se menciona playa', async () => {
    const reply = await provider.generate(msg('quiero ir a la playa'), []);
    expect(reply.toLowerCase()).toContain('playa salgar');
  });

  it('responde con sugerencia de restaurantes cuando se menciona comer', async () => {
    const reply = await provider.generate(msg('donde puedo comer rico'), []);
    expect(reply).toMatch(/Cueva|Vintrash/i);
  });

  it('responde con sugerencia de hoteles cuando se menciona hotel', async () => {
    const reply = await provider.generate(msg('busco un hotel'), []);
    expect(reply).toMatch(/Prado|Movich/i);
  });

  it('responde sobre vida nocturna cuando se menciona bar', async () => {
    const reply = await provider.generate(msg('quiero un bar bueno'), []);
    expect(reply).toMatch(/Frogg|Troja/i);
  });

  it('responde sobre museos cuando se menciona museo', async () => {
    const reply = await provider.generate(msg('quiero conocer un museo'), []);
    expect(reply).toMatch(/Caribe|Romantico/i);
  });

  it('responde sobre tours cuando se menciona tour', async () => {
    const reply = await provider.generate(msg('busco un tour'), []);
    expect(reply.toLowerCase()).toContain('tour');
  });

  it('responde con saludo cuando se dice hola', async () => {
    const reply = await provider.generate(msg('hola'), []);
    expect(reply).toMatch(/Xitty/);
  });

  it('responde generico cuando no hay keyword', async () => {
    const reply = await provider.generate(msg('xyz'), []);
    expect(reply).toMatch(/Xitty/i);
  });

  it('incluye context snippets en la respuesta cuando hay snippets', async () => {
    const reply = await provider.generate(msg('playa'), [
      { id: 'p1', name: 'Playa Salgar', average_rating: 4.5 },
      { id: 'p2', name: 'Pradomar', average_rating: 4.2 },
    ]);
    expect(reply).toContain('Pradomar');
  });
});
