import RESTless from '../src/core';
import FixtureAdapter from './fixture-adapter';
import LSAdapter from './ls-adapter';
import '../src/index';

/*
  Export public addon modules to namespace
*/
RESTless.FixtureAdapter = FixtureAdapter;
RESTless.LSAdapter = LSAdapter;
