import { ForbiddenException } from '@nestjs/common';

import { RankingController } from './ranking.controller';
import type { RankingService } from './ranking.service';

type RankingServiceMock = Pick<
  RankingService,
  'refresh' | 'getConfig' | 'updateConfig'
>;

function requestWithRole(role: string) {
  return { user: { role } };
}

describe('RankingController', () => {
  let controller: RankingController;
  let service: jest.Mocked<RankingServiceMock>;

  beforeEach(() => {
    service = {
      refresh: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
    };
    controller = new RankingController(service as unknown as RankingService);
  });

  it('permite a admin refrescar ranking', async () => {
    service.refresh.mockResolvedValueOnce({
      refreshed_at: '2026-07-09T12:00:00.000Z',
    });

    await expect(controller.refresh(requestWithRole('admin'))).resolves.toEqual(
      {
        refreshed_at: '2026-07-09T12:00:00.000Z',
      },
    );
    expect(service.refresh).toHaveBeenCalledTimes(1);
  });

  it('rechaza refresh de usuarios no admin', async () => {
    await expect(
      controller.refresh(requestWithRole('business')),
    ).rejects.toThrow(ForbiddenException);
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it('permite a admin leer configuracion', async () => {
    service.getConfig.mockResolvedValueOnce({
      id: 'default',
      rating_weight: 0.45,
      views_weight: 0.25,
      conversions_weight: 0.3,
      rating_prior: 4.2,
      rating_prior_reviews: 10,
      views_cap: 500,
      conversions_cap: 100,
      window_days: 30,
      updated_at: '2026-07-09T00:00:00.000Z',
      weight_total: 1,
    });

    await controller.getConfig(requestWithRole('admin'));

    expect(service.getConfig).toHaveBeenCalledTimes(1);
  });

  it('permite a admin editar configuracion', async () => {
    service.updateConfig.mockResolvedValueOnce({
      id: 'default',
      rating_weight: 0.5,
      views_weight: 0.2,
      conversions_weight: 0.3,
      rating_prior: 4.2,
      rating_prior_reviews: 10,
      views_cap: 500,
      conversions_cap: 100,
      window_days: 30,
      updated_at: '2026-07-09T00:00:00.000Z',
      weight_total: 1,
    });

    await controller.updateConfig(requestWithRole('admin'), {
      rating_weight: 0.5,
    });

    expect(service.updateConfig).toHaveBeenCalledWith({ rating_weight: 0.5 });
  });

  it('rechaza lectura y edicion de usuarios no admin', async () => {
    await expect(
      controller.getConfig(requestWithRole('business')),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateConfig(requestWithRole('business'), {
        views_weight: 0.4,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(service.getConfig).not.toHaveBeenCalled();
    expect(service.updateConfig).not.toHaveBeenCalled();
  });
});
