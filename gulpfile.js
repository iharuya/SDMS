'use strict';

const gulp = require('gulp');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');

const paths = {
	'cssSrc': './sass/main.scss',
	'cssDist': './public/css/',
  }


gulp.task('sass', (done) => {
	gulp.src(paths.cssSrc)
		.pipe(plumber({
			errorHandler: notify.onError("Error: <%= error.message %>")
		}))
		.pipe(sass({
			outputStyle: 'expanded' // 'compressed'
		}))
		.pipe(autoprefixer())
		.pipe(gulp.dest(paths.cssDist))
	done()
});

gulp.task('sass:prod', (done) => {
	gulp.src(paths.cssSrc)
		.pipe(plumber({
			errorHandler: notify.onError("Error: <%= error.message %>")
		}))
		.pipe(sass({
			outputStyle: 'compressed'
		}))
		.pipe(autoprefixer())
		.pipe(gulp.dest(paths.cssDist))
	done()
});


gulp.task('sass:watch', (done) => {
	gulp.watch('./sass/**/*.scss', gulp.task('sass'));
	done()
});


gulp.task('default', gulp.task('sass:watch'));
gulp.task('prod', gulp.task('sass:prod'));