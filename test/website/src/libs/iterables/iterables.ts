export namespace Iterables {

  export function* map<I, R>(iterable: Iterable<I>, mapper: (i: I) => R) {
    for (const element of iterable)
      yield mapper(element)
  }

}