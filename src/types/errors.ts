export class LoadModerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoadModerError';
  }
}

export class InstanceNotFoundError extends LoadModerError {
  constructor(identifier: string) {
    super(`Instance dengan id/nama "${identifier}" tidak ditemukan.`);
    this.name = 'InstanceNotFoundError';
  }
}

export class CorruptStateError extends LoadModerError {
  constructor(filePath: string) {
    super(`Berkas status mengalami kerusakan: ${filePath}`);
    this.name = 'CorruptStateError';
  }
}

export class ModpackError extends LoadModerError {
  constructor(message: string) {
    super(message);
    this.name = 'ModpackError';
  }
}

export class BisectStateError extends LoadModerError {
  constructor(message: string) {
    super(message);
    this.name = 'BisectStateError';
  }
}
