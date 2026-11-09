FROM php:8.3-apache

RUN docker-php-ext-install mysqli \
    && a2enmod rewrite

WORKDIR /var/www/html
COPY admin/ ./

RUN mkdir -p /var/www/server/uploads \
    && chown -R www-data:www-data /var/www/html /var/www/server

EXPOSE 8000